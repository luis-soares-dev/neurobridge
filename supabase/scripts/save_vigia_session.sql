-- SUBSTITUÍDO por migrations/002_server_scoring_and_rls.sql (pontuação calculada no servidor). Mantido como histórico.
-- Aplicar após 001_init.sql. Sem mudanças nas tabelas existentes.
-- Operação atômica: qualquer erro desfaz sessão, eventos, XP e progresso.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_vigia_session(
  p_session_id uuid, p_started_at timestamptz, p_difficulty integer,
  p_k_score numeric, p_trials jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_xp integer;
  v_correct integer;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  -- Serializa partidas da mesma conta, inclusive em abas diferentes.
  PERFORM 1 FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  -- Repetição após perda de conexão não duplica XP nem eventos.
  IF EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session_id AND user_id = v_user) THEN
    RETURN p_session_id;
  END IF;
  IF p_session_id IS NULL OR p_started_at IS NULL OR p_started_at > now()
     OR p_difficulty IS NULL OR p_difficulty NOT BETWEEN 1 AND 10
     OR p_k_score IS NULL OR p_k_score NOT BETWEEN 0 AND 1
     OR p_trials IS NULL OR jsonb_typeof(p_trials) <> 'array' THEN
    RAISE EXCEPTION 'Partida inválida';
  END IF;
  v_count := jsonb_array_length(p_trials);
  IF v_count <> 30 THEN RAISE EXCEPTION 'Partida incompleta'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_trials) t
    WHERE jsonb_typeof(t->'isTarget') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(t->'responded') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(t->'isCorrect') IS DISTINCT FROM 'boolean'
       OR (t->>'color') IS NULL
       OR (t->>'color') NOT IN ('azul','vermelho','verde','laranja','ciano','roxo')
       OR (t->>'isTarget')::boolean IS DISTINCT FROM (t->>'color' = 'azul')
       OR (t->>'isCorrect')::boolean IS DISTINCT FROM ((t->>'isTarget')::boolean = (t->>'responded')::boolean)
       OR ((t->>'responded')::boolean AND (
           jsonb_typeof(t->'responseTime') IS DISTINCT FROM 'number'
           OR (t->>'responseTime')::numeric NOT BETWEEN 0 AND 1100
           OR (t->>'responseTime')::numeric <> trunc((t->>'responseTime')::numeric)))
       OR (NOT (t->>'responded')::boolean AND t->'responseTime' IS DISTINCT FROM 'null'::jsonb)
  ) THEN RAISE EXCEPTION 'Respostas inválidas'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_trials) t WHERE (t->>'isTarget')::boolean) <> 8 THEN
    RAISE EXCEPTION 'Quantidade de alvos inválida';
  END IF;
  SELECT count(*) INTO v_correct FROM jsonb_array_elements(p_trials) t WHERE (t->>'isCorrect')::boolean;
  v_xp := 50 + round(p_k_score * 100)::integer + (p_difficulty - 1) * 5 + 15;
  INSERT INTO public.sessions (id,user_id,game_id,domain,started_at,ended_at,k_score,difficulty_level,xp_earned,total_trials,correct_trials)
  VALUES (p_session_id,v_user,'vigia','atencao',p_started_at,now(),p_k_score,p_difficulty,v_xp,v_count,v_correct);
  INSERT INTO public.game_events (session_id,user_id,event_type,is_correct,response_time,difficulty,occurred_at)
  SELECT p_session_id,v_user,
    'vigia:' || ord::text || ':' || (t->>'color') || ':' ||
    CASE WHEN (t->>'isTarget')::boolean THEN
      CASE WHEN (t->>'responded')::boolean THEN 'hit' ELSE 'miss' END
    ELSE CASE WHEN (t->>'responded')::boolean THEN 'false_alarm' ELSE 'correct_rejection' END END,
    (t->>'isCorrect')::boolean,(t->>'responseTime')::integer,p_difficulty,now()
  FROM jsonb_array_elements(p_trials) WITH ORDINALITY a(t,ord);
  UPDATE public.profiles SET xp_total = xp_total + v_xp,
    level = (xp_total + v_xp) / 500 + 1, updated_at = now() WHERE id = v_user;
  INSERT INTO public.progress (user_id,game_id,domain,last_k_score,best_k_score,total_sessions,last_played_at,k_score_history)
  VALUES (v_user,'vigia','atencao',p_k_score,p_k_score,1,now(),ARRAY[p_k_score])
  ON CONFLICT (user_id,game_id) DO UPDATE SET
    last_k_score = EXCLUDED.last_k_score,
    best_k_score = greatest(public.progress.best_k_score,EXCLUDED.best_k_score),
    total_sessions = public.progress.total_sessions + 1,
    last_played_at = now(),
    k_score_history = (coalesce(public.progress.k_score_history,'{}') || ARRAY[p_k_score])[
      greatest(1,coalesce(array_length(public.progress.k_score_history,1),0) - 28):];
  RETURN p_session_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_vigia_session(uuid,timestamptz,integer,numeric,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_vigia_session(uuid,timestamptz,integer,numeric,jsonb) TO authenticated;
COMMIT;
