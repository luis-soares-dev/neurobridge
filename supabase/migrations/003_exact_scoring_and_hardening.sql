-- ──────────────────────────────────────────────────────────────────────────────
-- NeuroBridge — Migração 003: pontuação em aritmética exata e ajustes do Advisor
--
-- 1. save_vigia_session passa a calcular a pontuação só com inteiros. Na 002,
--    a média de tempos com dízima (ex.: 496,1666…) fazia o banco arredondar
--    0,6355 para 0,635 enquanto o app dava 0,636 (~1 em 300 partidas).
--    Mesma fórmula, mesma assinatura; o app não muda.
-- 2. handle_new_user é função de trigger e deixa de ficar exposta em /rest/v1/rpc
--    (privilégio herdado dos padrões do schema public desde a 001).
-- 3. Cria a linha de streaks para perfis que ficaram sem ela. Não altera dados existentes.
-- Aplicar depois da 002. Idempotente.
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

INSERT INTO public.streaks (user_id)
SELECT p.id FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

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
  v_sum_rt bigint;
  v_num bigint;
  v_den bigint;
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
    coalesce(sum((t->>'responseTime')::integer) FILTER (WHERE (t->>'isTarget')::boolean AND (t->>'responded')::boolean), 0)
  INTO v_targets, v_non_targets, v_hits, v_false_alarms, v_correct, v_sum_rt
  FROM jsonb_array_elements(p_trials) t;

  IF v_targets <> 8 THEN RAISE EXCEPTION 'Quantidade de alvos inválida'; END IF;

  -- Mesma conta de scoreVigia (src/games/vigia/engine.ts), só com inteiros:
  --   pontuação = max(0, h·N − f·T) · (5·h·W − ΣRT) / (5·T·N·h·W), milésimos com meio para cima.
  IF v_hits > 0 THEN
    v_num := greatest(0, v_hits * v_non_targets - v_false_alarms * v_targets)::bigint
             * (5::bigint * v_hits * v_stimulus - v_sum_rt);
    v_den := 5::bigint * v_targets * v_non_targets * v_hits * v_stimulus;
    v_score := ((2000 * v_num + v_den) / (2 * v_den))::numeric / 1000;
  ELSE
    v_score := 0;
  END IF;
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
