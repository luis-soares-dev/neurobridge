import { describe, expect, it } from 'vitest'
import { seededRandom } from '../core/random'
import { TARGET_COUNT, TIMING, TOTAL_TRIALS } from './config'
import { generateStimuli } from './engine'
import { createSession, reduceSession, visibleStimulus, type SessionEvent, type SessionState } from './session'

const SEED = Number(process.env.TEST_SEED ?? 20261030)
const D = 5
const W = TIMING[D].stimulus

function run(s: SessionState, ...events: SessionEvent[]) {
  return events.reduce(reduceSession, s)
}
/** Leva uma sessão nova até a primeira exposição, no instante `at`. */
function toExposure(s: SessionState, at = 3000) {
  return run(s, { type: 'tick', at: 1000 }, { type: 'tick', at: 2000 }, { type: 'tick', at }, { type: 'frameShown', at: at + 16 })
}
/** Conclui a tentativa atual (com resposta opcional) e passa pelo intervalo. */
function completeTrial(s: SessionState, at: number, respondAfter: number | null) {
  const evs: SessionEvent[] = []
  if (respondAfter !== null) evs.push({ type: 'respond', at: at + respondAfter })
  evs.push({ type: 'exposureEnd', at: at + W }, { type: 'gapEnd', at: at + W + TIMING[D].iti })
  return run(s, ...evs)
}
const random = seededRandom(SEED)
const fresh = () => createSession(generateStimuli(D, seededRandom(SEED)), D)

describe('ciclo da partida', () => {
  it('só começa a contar o tempo de resposta depois que o quadro é desenhado', () => {
    let s = run(fresh(), { type: 'tick', at: 1 }, { type: 'tick', at: 2 }, { type: 'tick', at: 3000 })
    expect(s.phase).toBe('presenting')
    expect(visibleStimulus(s)).not.toBeNull()
    s = reduceSession(s, { type: 'respond', at: 3005 }) // ainda não desenhado: ignorado
    expect(s.response).toBeNull()
    s = run(s, { type: 'frameShown', at: 3016 }, { type: 'respond', at: 3316 })
    expect(s.response).toBe(300)
  })

  it('recusa resposta depois do fim da janela, em vez de limitá-la', () => {
    const s = run(toExposure(fresh()), { type: 'respond', at: 3016 + W + 1 })
    expect(s.response).toBeNull()
  })

  it('ignora segunda resposta na mesma tentativa', () => {
    const s = run(toExposure(fresh()), { type: 'respond', at: 3116 }, { type: 'respond', at: 3216 })
    expect(s.response).toBe(100)
  })

  it('partida completa tem 30 tentativas e 8 alvos, e soma só o tempo ativo', () => {
    let s = toExposure(fresh())
    let at = 3016
    while (s.phase !== 'finished') {
      s = completeTrial(s, at, visibleStimulus(s)!.isTarget ? 250 : null)
      at += W + TIMING[D].iti
      if (s.phase === 'presenting') s = reduceSession(s, { type: 'frameShown', at })
    }
    expect(s.trials).toHaveLength(TOTAL_TRIALS)
    expect(s.trials.filter(t => t.isTarget)).toHaveLength(TARGET_COUNT)
    expect(s.trials.every(t => t.isCorrect)).toBe(true)
    expect(s.activeMs).toBe(at - 3000)
  })
})

describe(`pausa e interrupções (TEST_SEED=${SEED})`, () => {
  it('pausa no intervalo preserva a tentativa concluída e continua na próxima', () => {
    let s = toExposure(fresh())
    const first = visibleStimulus(s)!
    s = run(s, { type: 'respond', at: 3216 }, { type: 'exposureEnd', at: 3016 + W })
    expect(s.phase).toBe('gap')
    const next = s.queue[0]
    s = run(s, { type: 'pause', at: 3016 + W + 100, reason: 'user', random }, { type: 'resume' })
    expect(s.trials).toHaveLength(1)
    expect(s.trials[0]).toMatchObject({ color: first.color, responded: true, responseTime: 200 })
    s = run(s, { type: 'tick', at: 10_000 }, { type: 'tick', at: 11_000 }, { type: 'tick', at: 12_000 })
    expect(visibleStimulus(s)).toBe(next)
  })

  it('pausa durante a exposição descarta a tentativa, reembaralha o restante e mantém a contagem', () => {
    let s = toExposure(fresh())
    const before = s.queue.map(x => x.isTarget).filter(Boolean).length
    s = run(s, { type: 'respond', at: 3100 }, { type: 'pause', at: 3200, reason: 'user', random })
    expect(s.phase).toBe('paused')
    expect(s.trials).toHaveLength(0)
    expect(s.response).toBeNull()
    expect(s.interruptions).toBe(1)
    expect(s.queue).toHaveLength(TOTAL_TRIALS)
    expect(s.queue.filter(x => x.isTarget)).toHaveLength(before)
  })

  it('o estímulo visto antes da pausa não volta necessariamente em seguida', () => {
    // Com o restante reembaralhado, o mesmo estímulo só volta primeiro em ~1/30 dos casos.
    let sameObject = 0
    for (let i = 0; i < 300; i++) {
      let s = toExposure(createSession(generateStimuli(D, seededRandom(SEED + i)), D))
      const seen = visibleStimulus(s)
      s = run(s, { type: 'pause', at: 3100, reason: 'user', random: seededRandom(SEED * 7 + i) })
      if (s.queue[0] === seen) sameObject++
    }
    expect(sameObject).toBeLessThan(30)
  })

  it('tela não desenhada a tempo pausa a partida como interrupção técnica', () => {
    let s = run(fresh(), { type: 'tick', at: 1 }, { type: 'tick', at: 2 }, { type: 'tick', at: 3000 })
    s = reduceSession(s, { type: 'frameTimeout', at: 3300, random })
    expect(s).toMatchObject({ phase: 'paused', pauseReason: 'render', interruptions: 1 })
    expect(s.trials).toHaveLength(0)
  })

  it('tempo de pausa e contagem regressiva não entram no tempo ativo', () => {
    let s = toExposure(fresh(), 3000)
    s = run(s, { type: 'pause', at: 3500, reason: 'hidden', random })
    expect(s.activeMs).toBe(500)
    s = run(s, { type: 'resume' }, { type: 'tick', at: 3_600_000 }, { type: 'tick', at: 3_601_000 }, { type: 'tick', at: 3_602_000 })
    s = run(s, { type: 'frameShown', at: 3_602_016 }, { type: 'exposureEnd', at: 3_602_016 + W })
    expect(s.activeMs).toBe(500)
    s = run(s, { type: 'pause', at: 3_602_016 + W + 10, reason: 'user', random })
    expect(s.activeMs).toBe(500 + 16 + W + 10)
  })

  it('eventos fora de hora não alteram o estado', () => {
    const s = fresh()
    for (const e of [
      { type: 'frameShown', at: 1 }, { type: 'respond', at: 1 }, { type: 'exposureEnd', at: 1 },
      { type: 'gapEnd', at: 1 }, { type: 'resume' }, { type: 'frameTimeout', at: 1, random },
    ] as SessionEvent[]) expect(reduceSession(s, e)).toBe(s)
  })
})
