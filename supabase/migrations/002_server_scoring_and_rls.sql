-- ──────────────────────────────────────────────────────────────────────────────
-- NeuroBridge — Migração 002: pontuação calculada no servidor e permissões mínimas
--
-- Aplicar depois de 001_init.sql. Pode ser aplicada com ou sem o antigo
-- scripts/save_vigia_session.sql (a função antiga é substituída). Idempotente.
--
-- O que muda:
--   1. handle_new_user com search_path fixo (recomendação de segurança do Supabase).
--   2. Tabelas viram somente leitura para o app; escrita só pela função abaixo.
--      O usuário ainda pode editar o próprio nome e foto.
--   3. save_vigia_session recebe só as respostas e a duração; pontuação, XP e
--      próximo nível são calculados aqui. Recusa partidas impossíveis
--      (curtas demais, em sequência rápida demais, respostas fora da janela).
--
-- Os parâmetros do Vigia (tempos e cores) espelham src/games/vigia/config.ts;
-- supabase/tests/server-scoring.test.ts verifica que os dois cálculos coincidem.
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ── 1. Perfil criado no cadastro ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.streaks (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 2. RLS: cada usuário lê só os próprios dados; escrita só via função ──────
DROP POLICY IF EXISTS "profiles: dono pode tudo" ON public.profiles;
DROP POLICY IF EXISTS "sessions: dono pode tudo" ON public.sessions;
DROP POLICY IF EXISTS "game_events: dono pode tudo" ON public.game_events;
DROP POLICY IF EXISTS "progress: dono pode tudo" ON public.progress;
DROP POLICY IF EXISTS "streaks: dono pode tudo" ON public.streaks;

DROP POLICY IF EXISTS "profiles: dono lê" ON public.profiles;
CREATE POLICY "profiles: dono lê" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS "profiles: dono edita nome e foto" ON public.profiles;
CREATE POLICY "profiles: dono edita nome e foto" ON public.profiles
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS "sessions: dono lê" ON public.sessions;
CREATE POLICY "sessions: dono lê" ON public.sessions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "game_events: dono lê" ON public.game_events;
CREATE POLICY "game_events: dono lê" ON public.game_events
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "progress: dono lê" ON public.progress;
CREATE POLICY "progress: dono lê" ON public.progress
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "streaks: dono lê" ON public.streaks;
CREATE POLICY "streaks: dono lê" ON public.streaks
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Privilégios de tabela (complementam o RLS): sem escrita direta pela API.
REVOKE ALL ON public.profiles, public.sessions, public.game_events, public.progress, public.streaks FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles, public.sessions, public.game_events, public.progress, public.streaks FROM authenticated;
GRANT SELECT ON public.profiles, public.sessions, public.game_events, public.progress, public.streaks TO authenticated;
GRANT UPDATE (name, avatar_url) ON public.profiles TO authenticated;

-- ── 3. Regras comuns ─────────────────────────────────────────────────────────
-- Igual a adjustDifficulty em src/games/core/difficulty.ts.
CREATE OR REPLACE FUNCTION public.next_difficulty(p_score numeric, p_level integer)
RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_score IS NULL THEN p_level
    WHEN p_score > 0.7 THEN least(10, p_level + 1)
    WHEN p_score < 0.4 THEN greatest(1, p_level - 1)
    ELSE p_level
  END
$$;

-- ── 4. Salvamento do Vigia com pontuação oficial ─────────────────────────────
DROP FUNCTION IF EXISTS public.save_vigia_session(uuid, timestamptz, integer, numeric, jsonb);

CREATE OR REPLACE FUNCTION public.save_vigia_session(
  p_session_id uuid, p_duration_ms integer, p_difficulty integer, p_trials jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.sessions%ROWTYPE;
  v_stimulus integer;
  v_iti integer;
  v_min_duration integer;
  v_colors text[];
  v_targets integer;
  v_non_targets integer;
  v_hits integer;
  v_false_alarms integer;
  v_correct integer;
  v_mean_rt numeric;
  v_precision numeric;
  v_speed numeric;
  v_score numeric(4, 3);
  v_xp integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;

  -- Serializa partidas da mesma conta, inclusive em abas diferentes.
  PERFORM 1 FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  -- Reenvio após falha de conexão: devolve o que já foi gravado, sem duplicar.
  SELECT * INTO v_existing FROM public.sessions WHERE id = p_session_id AND user_id = v_user;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'session_id', v_existing.id, 'k_score', v_existing.k_score, 'xp_earned', v_existing.xp_earned,
      'next_difficulty', public.next_difficulty(v_existing.k_score, v_existing.difficulty_level),
      'already_saved', true);
  END IF;

  IF p_session_id IS NULL OR p_difficulty IS NULL OR p_difficulty NOT BETWEEN 1 AND 10
     OR p_duration_ms IS NULL OR p_trials IS NULL OR jsonb_typeof(p_trials) <> 'array' THEN
    RAISE EXCEPTION 'Partida inválida';
  END IF;

  -- Mesmos valores de TIMING e distractorsFor em src/games/vigia/config.ts.
  v_stimulus := (ARRAY[1100, 1000, 900, 800, 700, 650, 600, 550, 500, 450])[p_difficulty];
  v_iti := (ARRAY[900, 800, 700, 600, 550, 500, 450, 400, 350, 300])[p_difficulty];
  v_colors := CASE
    WHEN p_difficulty <= 3 THEN ARRAY['azul', 'vermelho', 'verde', 'laranja']
    WHEN p_difficulty <= 6 THEN ARRAY['azul', 'vermelho', 'verde', 'laranja', 'ciano']
    ELSE ARRAY['azul', 'vermelho', 'verde', 'laranja', 'ciano', 'roxo']
  END;
  v_min_duration := floor(30 * (v_stimulus + v_iti) * 0.9);

  IF p_duration_ms < v_min_duration OR p_duration_ms > 3600000 THEN
    RAISE EXCEPTION 'Duração da partida inválida';
  END IF;
  IF jsonb_array_length(p_trials) <> 30 THEN RAISE EXCEPTION 'Partida incompleta'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_trials) t
    WHERE jsonb_typeof(t) <> 'object'
       OR jsonb_typeof(t->'isTarget') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(t->'responded') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(t->'isCorrect') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(t->'color') IS DISTINCT FROM 'string'
       OR NOT ((t->>'color') = ANY (v_colors))
       OR (t->>'isTarget')::boolean IS DISTINCT FROM ((t->>'color') = 'azul')
       OR (t->>'isCorrect')::boolean IS DISTINCT FROM ((t->>'isTarget')::boolean = (t->>'responded')::boolean)
       OR ((t->>'responded')::boolean AND (
            jsonb_typeof(t->'responseTime') IS DISTINCT FROM 'number'
            OR (t->>'responseTime')::numeric NOT BETWEEN 0 AND v_stimulus
            OR (t->>'responseTime')::numeric <> trunc((t->>'responseTime')::numeric)))
       OR (NOT (t->>'responded')::boolean AND t->'responseTime' IS DISTINCT FROM 'null'::jsonb)
  ) THEN
    RAISE EXCEPTION 'Respostas inválidas';
  END IF;

  -- Nenhuma partida termina antes do tempo mínimo de jogo após a anterior.
  IF EXISTS (
    SELECT 1 FROM public.sessions
    WHERE user_id = v_user AND game_id = 'vigia'
      AND ended_at > now() - make_interval(secs => v_min_duration / 1000.0)
  ) THEN
    RAISE EXCEPTION 'Partidas em sequência rápida demais';
  END IF;

  SELECT
    count(*) FILTER (WHERE (t->>'isTarget')::boolean),
    count(*) FILTER (WHERE NOT (t->>'isTarget')::boolean),
    count(*) FILTER (WHERE (t->>'isTarget')::boolean AND (t->>'responded')::boolean),
    count(*) FILTER (WHERE NOT (t->>'isTarget')::boolean AND (t->>'responded')::boolean),
    count(*) FILTER (WHERE (t->>'isCorrect')::boolean),
    avg((t->>'responseTime')::numeric) FILTER (WHERE (t->>'isTarget')::boolean AND (t->>'responded')::boolean)
  INTO v_targets, v_non_targets, v_hits, v_false_alarms, v_correct, v_mean_rt
  FROM jsonb_array_elements(p_trials) t;

  IF v_targets <> 8 THEN RAISE EXCEPTION 'Quantidade de alvos inválida'; END IF;

  -- Mesma fórmula de scoreVigia (src/games/vigia/engine.ts).
  v_precision := greatest(0, v_hits::numeric / v_targets - v_false_alarms::numeric / v_non_targets);
  v_speed := CASE WHEN v_hits > 0 THEN least(1, greatest(0, 1 - 0.5 * (v_mean_rt / v_stimulus))) ELSE 0 END;
  v_score := round(v_precision * (0.6 + 0.4 * v_speed), 3);
  -- Mesma fórmula de calculateXP (src/games/core/score.ts).
  v_xp := 50 + round(v_score * 100)::integer + (p_difficulty - 1) * 5 + 15;

  INSERT INTO public.sessions (id, user_id, game_id, domain, started_at, ended_at, k_score,
                               difficulty_level, xp_earned, total_trials, correct_trials)
  VALUES (p_session_id, v_user, 'vigia', 'atencao', now() - make_interval(secs => p_duration_ms / 1000.0), now(),
          v_score, p_difficulty, v_xp, 30, v_correct);

  INSERT INTO public.game_events (session_id, user_id, event_type, is_correct, response_time, difficulty, occurred_at)
  SELECT p_session_id, v_user,
    'vigia:' || ord::text || ':' || (t->>'color') || ':' ||
    CASE WHEN (t->>'isTarget')::boolean THEN
      CASE WHEN (t->>'responded')::boolean THEN 'hit' ELSE 'miss' END
    ELSE CASE WHEN (t->>'responded')::boolean THEN 'false_alarm' ELSE 'correct_rejection' END END,
    (t->>'isCorrect')::boolean, (t->>'responseTime')::integer, p_difficulty, now()
  FROM jsonb_array_elements(p_trials) WITH ORDINALITY a(t, ord);

  UPDATE public.profiles
  SET xp_total = xp_total + v_xp, level = (xp_total + v_xp) / 500 + 1, updated_at = now()
  WHERE id = v_user;

  INSERT INTO public.progress (user_id, game_id, domain, last_k_score, best_k_score, total_sessions, last_played_at, k_score_history)
  VALUES (v_user, 'vigia', 'atencao', v_score, v_score, 1, now(), ARRAY[v_score])
  ON CONFLICT (user_id, game_id) DO UPDATE SET
    last_k_score = EXCLUDED.last_k_score,
    best_k_score = greatest(public.progress.best_k_score, EXCLUDED.best_k_score),
    total_sessions = public.progress.total_sessions + 1,
    last_played_at = now(),
    k_score_history = (coalesce(public.progress.k_score_history, '{}') || ARRAY[v_score])[
      greatest(1, coalesce(array_length(public.progress.k_score_history, 1), 0) - 28):];

  RETURN jsonb_build_object(
    'session_id', p_session_id, 'k_score', v_score, 'xp_earned', v_xp,
    'next_difficulty', public.next_difficulty(v_score, p_difficulty),
    'already_saved', false);
END;
$$;

REVOKE ALL ON FUNCTION public.save_vigia_session(uuid, integer, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_vigia_session(uuid, integer, integer, jsonb) TO authenticated;

COMMIT;
