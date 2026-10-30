// Catálogo de jogos da plataforma. Para lançar um jogo novo, adicione-o aqui,
// crie a pasta em src/games/<id> e registre a rota em src/app/App.tsx.
import type { GameInfo } from './core/types'

export const GAMES: GameInfo[] = [
  { id: 'vigia', name: 'Vigia', domain: 'atencao', tagline: 'Atenção · cerca de 1 minuto', icon: '🎯', route: '/jogar/vigia', available: true },
  { id: 'lente', name: 'Lente', domain: 'memoria', tagline: 'Memória de trabalho', icon: '🔍', route: '/jogar/lente', available: false },
  { id: 'duo', name: 'Duo', domain: 'flexibilidade', tagline: 'Flexibilidade', icon: '🔀', route: '/jogar/duo', available: false },
]
