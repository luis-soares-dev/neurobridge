// Testa a migração 002 num PostgreSQL local (PGlite): pontuação no servidor,
// idempotência, validações e isolamento entre contas. Não acessa o Supabase remoto.
import { beforeAll, describe, expect, it } from 'vitest'
import { generateStimuli, makeTrial, computeResults, minimumDurationMs, type VigiaTrial } from '../../src/games/vigia/engine'
import type { DifficultyLevel } from '../../src/games/core/types'
import { ageSessions, asUser, createDb, createUser, sql, type Db } from './db'

interface Saved { session_id: string; k_score: number; xp_earned: number; next_difficulty: number; already_saved: boolean }

function randomGame(d: DifficultyLevel, hitChance = 0.85, faChance = 0.1) {
  return generateStimuli(d).map(s => {
    const responds = Math.random() < (s.isTarget ? hitChance : faChance)
    return makeTrial(s, responds ? 150 + Math.random() * 1000 : null, d)
  })
}

async function save(db: Db, userId: string | null, trials: VigiaTrial[], d: DifficultyLevel, opts: { id?: string; duration?: number } = {}) {
  return asUser(db, userId, async () => {
    const r = await db.query<{ r: Saved }>(
      'SELECT public.save_vigia_session($1, $2, $3, $4) AS r',
      [opts.id ?? crypto.randomUUID(), opts.duration ?? minimumDurationMs(d) + 5000, d, JSON.stringify(trials)],
    )
    return r.rows[0].r
  })
}

let db: Db
beforeAll(async () => { db = await createDb({ withLegacyScript: true }) }, 60_000)

describe('migração', () => {
  it('substitui a função antiga que aceitava pontuação do cliente', async () => {
    const r = await db.query<{ args: string }>(
      `SELECT pg_get_function_identity_arguments(oid) AS args FROM pg_proc WHERE proname = 'save_vigia_session'`)
    expect(r.rows.map(x => x.args)).toEqual(['p_session_id uuid, p_duration_ms integer, p_difficulty integer, p_trials jsonb'])
  })
  it('pode ser aplicada de novo sem erro', async () => {
    await expect(db.exec(sql('supabase/migrations/002_server_scoring_and_rls.sql'))).resolves.toBeDefined()
  })
  it('cria perfil e sequência para usuário novo', async () => {
    const id = await createUser(db, 'Ana Souza')
    const p = await db.query<{ name: string }>('SELECT name FROM public.profiles WHERE id = $1', [id])
    const s = await db.query('SELECT 1 FROM public.streaks WHERE user_id = $1', [id])
    expect(p.rows[0].name).toBe('Ana Souza')
    expect(s.rows).toHaveLength(1)
  })
})

describe('pontuação oficial', () => {
  it('servidor e app calculam exatamente a mesma pontuação, XP e próximo nível', async () => {
    for (let i = 0; i < 40; i++) {
      const d = ((i % 10) + 1) as DifficultyLevel
      const trials = randomGame(d, Math.random(), Math.random() * 0.3)
      const expected = computeResults(trials, d)
      const saved = await save(db, await createUser(db), trials, d)
      expect({ k: Number(saved.k_score), xp: saved.xp_earned, next: saved.next_difficulty })
        .toEqual({ k: expected.score.score, xp: expected.xpEarned, next: expected.score.nextDifficulty })
    }
  }, 60_000)

  it('grava sessão, 30 eventos, XP e progresso uma única vez, mesmo com reenvio', async () => {
    const user = await createUser(db)
    const trials = randomGame(4)
    const id = crypto.randomUUID()
    const first = await save(db, user, trials, 4, { id })
    const again = await save(db, user, trials, 4, { id })
    expect(again).toMatchObject({ k_score: first.k_score, xp_earned: first.xp_earned, already_saved: true })

    const counts = await db.query<{ sessions: number; events: number; xp: number; total: number }>(`
      SELECT (SELECT count(*)::int FROM public.sessions WHERE user_id = $1) AS sessions,
             (SELECT count(*)::int FROM public.game_events WHERE user_id = $1) AS events,
             (SELECT xp_total FROM public.profiles WHERE id = $1) AS xp,
             (SELECT total_sessions FROM public.progress WHERE user_id = $1) AS total`, [user])
    expect(counts.rows[0]).toEqual({ sessions: 1, events: 30, xp: first.xp_earned, total: 1 })
  })

  it('mantém só os 30 últimos resultados no histórico', async () => {
    const user = await createUser(db)
    for (let i = 0; i < 32; i++) {
      await save(db, user, randomGame(3), 3)
      await ageSessions(db, user)
    }
    const r = await db.query<{ n: number; total: number }>(
      'SELECT array_length(k_score_history, 1) AS n, total_sessions AS total FROM public.progress WHERE user_id = $1', [user])
    expect(r.rows[0]).toEqual({ n: 30, total: 32 })
  }, 60_000)
})

describe('partidas recusadas', () => {
  const reject = async (label: string, mutate: (t: VigiaTrial[]) => unknown[], d: DifficultyLevel = 3, duration?: number) => {
    const user = await createUser(db)
    await expect(save(db, user, mutate(randomGame(d)) as VigiaTrial[], d, { duration }), label).rejects.toThrow()
    const n = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.sessions WHERE user_id = $1', [user])
    expect(n.rows[0].n, label).toBe(0)
  }

  it('recusa respostas impossíveis ou incoerentes', async () => {
    await reject('29 tentativas', t => t.slice(1))
    await reject('tempo acima da janela', t => t.map(x => x.responded ? { ...x, responseTime: 5000 } : x))
    await reject('acerto incoerente', t => t.map((x, i) => i === 0 ? { ...x, isCorrect: !x.isCorrect } : x))
    await reject('cor que não existe no nível', t => t.map(x => x.isTarget ? x : { ...x, color: 'roxo' }), 2)
    await reject('alvo marcado em cor errada', t => t.map(x => x.isTarget ? { ...x, color: 'verde' } : x))
    await reject('elemento que não é objeto', t => [...t.slice(1), 'x'])
  })

  it('recusa partida mais curta do que o jogo permite', async () => {
    await reject('duração curta', t => t, 3, 1000)
  })

  it('recusa partidas em sequência rápida demais (farm de XP)', async () => {
    const user = await createUser(db)
    await save(db, user, randomGame(3), 3)
    await expect(save(db, user, randomGame(3), 3)).rejects.toThrow(/sequência rápida/)
  })

  it('recusa quem não está logado e o papel anônimo', async () => {
    await expect(save(db, null, randomGame(3), 3)).rejects.toThrow(/Autenticação|permission/)
    const user = await createUser(db)
    await expect(asUser(db, user, () => db.query(
      'SELECT public.save_vigia_session($1, 60000, 3, $2)', [crypto.randomUUID(), JSON.stringify(randomGame(3))],
    ), 'anon')).rejects.toThrow(/permission/)
  })
})

describe('isolamento e permissões', () => {
  it('cada conta vê só os próprios dados', async () => {
    const ana = await createUser(db)
    const bruno = await createUser(db)
    await save(db, ana, randomGame(3), 3)
    const seen = await asUser(db, bruno, () => db.query<{ n: number }>(`
      SELECT (SELECT count(*) FROM public.sessions WHERE user_id = $1)
           + (SELECT count(*) FROM public.game_events WHERE user_id = $1)
           + (SELECT count(*) FROM public.progress WHERE user_id = $1)
           + (SELECT count(*) FROM public.profiles WHERE id = $1) AS n`, [ana]))
    expect(Number(seen.rows[0].n)).toBe(0)
    const own = await asUser(db, ana, () => db.query('SELECT 1 FROM public.sessions'))
    expect(own.rows).toHaveLength(1)
  })

  it('o app não consegue alterar XP, inserir partidas ou apagar dados diretamente', async () => {
    const ana = await createUser(db)
    const as = (q: string) => asUser(db, ana, () => db.query(q, [ana]))
    await expect(as('UPDATE public.profiles SET xp_total = 999999 WHERE id = $1')).rejects.toThrow(/permission/)
    await expect(as(`INSERT INTO public.sessions (user_id, game_id, domain) VALUES ($1, 'vigia', 'atencao')`)).rejects.toThrow(/permission/)
    await expect(as('DELETE FROM public.profiles WHERE id = $1')).rejects.toThrow(/permission/)
    await expect(as('UPDATE public.streaks SET current_streak = 99 WHERE user_id = $1')).rejects.toThrow(/permission/)
  })

  it('o dono ainda pode editar nome e foto', async () => {
    const ana = await createUser(db)
    await asUser(db, ana, () => db.query(`UPDATE public.profiles SET name = 'Ana B.' WHERE id = $1`, [ana]))
    const r = await db.query<{ name: string }>('SELECT name FROM public.profiles WHERE id = $1', [ana])
    expect(r.rows[0].name).toBe('Ana B.')
  })
})
