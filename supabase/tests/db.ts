// Banco PostgreSQL local (PGlite, em memória) com um Auth simulado no formato do Supabase.
// Roda as migrações reais do repositório, sem tocar em nenhum banco remoto.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

const root = resolve(__dirname, '..', '..')
export const sql = (path: string) => readFileSync(resolve(root, path), 'utf8')

export async function createDb({ withLegacyScript = false } = {}) {
  const db = await PGlite.create({ extensions: { uuid_ossp } })
  // O que o Supabase já fornece: papéis, schema auth e auth.uid(), privilégios padrão.
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
  `)
  await db.exec(sql('supabase/migrations/001_init.sql'))
  if (withLegacyScript) await db.exec(sql('supabase/scripts/save_vigia_session.sql'))
  await db.exec(sql('supabase/migrations/002_server_scoring_and_rls.sql'))
  await db.exec(sql('supabase/migrations/003_exact_scoring_and_hardening.sql'))
  return db
}

export type Db = Awaited<ReturnType<typeof createDb>>

export async function createUser(db: Db, name = 'Teste'): Promise<string> {
  const id = crypto.randomUUID()
  await db.query('INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1, $2)', [id, JSON.stringify({ full_name: name })])
  return id
}

/** Executa como um usuário logado (papel authenticated + auth.uid()). */
export async function asUser<T>(db: Db, userId: string | null, fn: () => Promise<T>, role = 'authenticated'): Promise<T> {
  await db.exec(`SET ROLE ${role}`)
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  try {
    return await fn()
  } finally {
    await db.exec('RESET ROLE')
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`)
  }
}

/** Faz as partidas anteriores parecerem antigas, para testar várias seguidas. */
export async function ageSessions(db: Db, userId: string) {
  await db.query(`UPDATE public.sessions SET ended_at = ended_at - interval '1 hour' WHERE user_id = $1`, [userId])
}
