-- ──────────────────────────────────────────────────────────────────────────────
-- NeuroBridge — Schema inicial do banco de dados
-- Migração 001: estrutura base
--
-- COMO EXECUTAR:
--   No painel do Supabase → SQL Editor → cole e execute
--
-- ANALOGIA:
--   Uma migração é como a planta de um prédio que será construído.
--   Cada ALTER TABLE ou CREATE TABLE é um cômodo sendo adicionado.
-- ──────────────────────────────────────────────────────────────────────────────

-- Ativa a extensão uuid-ossp para gerar IDs únicos automaticamente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABELA: profiles ──────────────────────────────────────────────────────────
-- Armazena o perfil público do usuário.
-- A autenticação (email/senha/OAuth) é gerenciada pelo Supabase Auth
-- na tabela auth.users — aqui guardamos apenas os dados do app.
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  avatar_url  TEXT,
  xp_total    INTEGER NOT NULL DEFAULT 0,
  level       INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentários explicativos (ficam visíveis no painel do Supabase)
COMMENT ON TABLE public.profiles IS 'Perfil do usuário no app NeuroBridge';
COMMENT ON COLUMN public.profiles.xp_total IS 'XP acumulado em todas as sessões';
COMMENT ON COLUMN public.profiles.level IS 'Nível atual: 1 a 50';

-- ── TABELA: sessions ──────────────────────────────────────────────────────────
-- Cada vez que o usuário joga, uma sessão é criada.
-- Uma sessão tem início, fim, e o K-Score calculado ao final.
CREATE TABLE IF NOT EXISTS public.sessions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id          TEXT NOT NULL CHECK (game_id IN ('vigia', 'lente', 'duo')),
  domain           TEXT NOT NULL CHECK (domain IN ('atencao', 'memoria', 'flexibilidade', 'velocidade', 'raciocinio')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  k_score          NUMERIC(4, 3),        -- Ex: 0.742 (3 casas decimais)
  difficulty_level INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 10),
  xp_earned        INTEGER NOT NULL DEFAULT 0,
  total_trials     INTEGER NOT NULL DEFAULT 0,
  correct_trials   INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.sessions IS 'Sessões de jogo — cada partida jogada';
COMMENT ON COLUMN public.sessions.k_score IS 'K-Score da sessão (0 a 1)';

-- Índice: acelera a busca por sessões de um usuário específico
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_game ON public.sessions(user_id, game_id);

-- ── TABELA: game_events ───────────────────────────────────────────────────────
-- Cada trial (tentativa) individual dentro de uma sessão.
-- Esses dados brutos permitem recalcular K-Score e analisar padrões.
CREATE TABLE IF NOT EXISTS public.game_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,       -- 'trial_hit' | 'trial_miss' | 'false_alarm'
  is_correct      BOOLEAN NOT NULL,
  response_time   INTEGER,             -- em milissegundos
  difficulty      INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.game_events IS 'Eventos individuais (trials) dentro de uma sessão';

CREATE INDEX IF NOT EXISTS idx_game_events_session ON public.game_events(session_id);

-- ── TABELA: progress ──────────────────────────────────────────────────────────
-- Agregado por usuário + jogo: last K-Score, best K-Score, total de sessões.
-- Evita recalcular tudo a cada vez que o usuário abre o dashboard.
CREATE TABLE IF NOT EXISTS public.progress (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id          TEXT NOT NULL CHECK (game_id IN ('vigia', 'lente', 'duo')),
  domain           TEXT NOT NULL,
  last_k_score     NUMERIC(4, 3),
  best_k_score     NUMERIC(4, 3) DEFAULT 0,
  total_sessions   INTEGER NOT NULL DEFAULT 0,
  last_played_at   TIMESTAMPTZ,
  k_score_history  NUMERIC(4, 3)[] DEFAULT '{}',  -- Array dos últimos 30 K-Scores
  UNIQUE (user_id, game_id)   -- Um registro por usuário por jogo
);

COMMENT ON TABLE public.progress IS 'Progresso agregado por usuário e jogo';

-- ── TABELA: streaks ───────────────────────────────────────────────────────────
-- Controla a sequência de dias ativos (como o Lumosity).
-- V1.5 vai adicionar os escudos de proteção.
CREATE TABLE IF NOT EXISTS public.streaks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,   -- Dias seguidos ativos
  longest_streak INTEGER NOT NULL DEFAULT 0,   -- Recorde pessoal
  last_active_at TIMESTAMPTZ,
  shields        INTEGER NOT NULL DEFAULT 0    -- Escudos de proteção (V1.5)
);

COMMENT ON TABLE public.streaks IS 'Sequência de dias ativos e escudos (V1.5)';

-- ── ROW LEVEL SECURITY (RLS) ──────────────────────────────────────────────────
-- RLS garante que cada usuário só vê e altera seus próprios dados.
-- É a camada de segurança mais importante do Supabase.
-- Sem isso, qualquer usuário poderia ler dados de outro.

ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks    ENABLE ROW LEVEL SECURITY;

-- Política: usuário só acessa seu próprio profile
CREATE POLICY "profiles: dono pode tudo" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Política: usuário só acessa suas próprias sessões
CREATE POLICY "sessions: dono pode tudo" ON public.sessions
  FOR ALL USING (auth.uid() = user_id);

-- Política: usuário só acessa seus próprios eventos
CREATE POLICY "game_events: dono pode tudo" ON public.game_events
  FOR ALL USING (auth.uid() = user_id);

-- Política: usuário só acessa seu próprio progresso
CREATE POLICY "progress: dono pode tudo" ON public.progress
  FOR ALL USING (auth.uid() = user_id);

-- Política: usuário só acessa sua própria streak
CREATE POLICY "streaks: dono pode tudo" ON public.streaks
  FOR ALL USING (auth.uid() = user_id);

-- ── FUNÇÃO: criar profile automaticamente ────────────────────────────────────
-- Quando um usuário se cadastra (via Google/Apple), o Supabase cria
-- uma entrada em auth.users automaticamente.
-- Esta função cria o profile correspondente em public.profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',   -- vem do Google/Apple
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  INSERT INTO public.streaks (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: executa a função toda vez que um usuário novo é criado
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
