# NeuroBridge

Plataforma de jogos curtos de atenção e memória, com dificuldade que se adapta ao jogador. Os jogos são entretenimento e treino. As pontuações medem o desempenho em cada partida e não são avaliação clínica.

**Stack:** React 18 · TypeScript · Vite · Zustand · Supabase (Auth Google, PostgreSQL com RLS)

## Rodando localmente

```bash
npm ci
cp .env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm test` | testes em modo observação |
| `npm run check` | typecheck + lint + testes + build (o mesmo da CI) |
| `npm run e2e` | testes de ponta a ponta no navegador (Playwright; usa o Chrome instalado ou `npx playwright install chromium`) |

Os testes de banco (`supabase/tests`) rodam num PostgreSQL local em memória (PGlite). Não precisam de Supabase nem de internet.

## Banco de dados

Migrações em `supabase/migrations`, aplicadas em ordem no SQL Editor do Supabase. Veja [IMPLEMENTACAO.md](IMPLEMENTACAO.md) para o checklist antes de publicar.

## Estrutura

- `src/games/core`: regras compartilhadas (dificuldade, pontuação, XP, preferências, telas comuns).
- `src/games/<jogo>`: `config.ts` (parâmetros), `engine.ts` (regras puras e testadas), hook e telas.
- `src/services`: único acesso ao Supabase.
- `src/features`: login e dashboard.
- `src/ui`: componentes visuais. Os tokens de cor ficam em `src/index.css`.
