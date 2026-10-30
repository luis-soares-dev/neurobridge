# AGENTS.md — NeuroBridge

Instruções para agentes de IA que trabalham ou revisam código neste repositório.

## O projeto

Plataforma web de jogos cognitivos curtos, com dificuldade adaptativa. Os jogos, a identidade visual e o código são originais; a inspiração em plataformas do mercado se limita a boas práticas de experiência e gamificação. Público amplo, que pode incluir pessoas neurodivergentes.

Stack: React 18, TypeScript (strict), Vite, Zustand, React Router (`createBrowserRouter`) e Supabase (Auth Google, PostgreSQL com RLS). Testes com Vitest, PGlite (SQL em memória) e Playwright.

## Comandos

| Comando | O que faz |
|---|---|
| `npm ci` | instala as dependências |
| `npm run check` | typecheck, lint, testes (unitários e SQL) e build: o mesmo da CI |
| `npm run e2e` | testes no navegador (Playwright, com o Supabase simulado por interceptação de rede) |
| `TEST_SEED=<n> npm run test:run` | repete os testes aleatórios com uma semente específica |

Os testes de banco (`supabase/tests`) rodam as migrações reais num PostgreSQL em memória e não acessam o Supabase remoto.

## Onde fica cada coisa

- `src/games/core/`: regras comuns (dificuldade, pontuação, XP, preferências, partidas pendentes, telas comuns).
- `src/games/vigia/`: `config.ts` (parâmetros), `engine.ts` (regras puras de pontuação), `session.ts` (ciclo da partida como função pura), `useVigiaGame.ts` (relógio e salvamento), telas.
- `src/services/`: único acesso ao Supabase, à autenticação e à classificação de erros.
- `supabase/migrations/`: migrações SQL, aplicadas em ordem.
- `IMPLEMENTACAO.md`: estado real do banco, decisões tomadas, verificações feitas e limites conhecidos.

## Regras do projeto (valem para código e para sugestões)

1. **Banco:** nenhuma mudança no banco remoto sem autorização explícita do dono. Migrações já aplicadas são imutáveis; correções entram em uma nova migração.
2. **Regras do jogo:** pontuação, XP, dificuldade e limiares não mudam sem uma proposta prévia que mostre o efeito no histórico. A fórmula existe em TypeScript (`engine.ts`) e em SQL (`save_vigia_session`); as duas devem dar exatamente o mesmo resultado, verificado por teste de paridade.
3. **Servidor como fonte oficial:** o cliente não decide XP, identidade nem propriedade dos dados. O servidor recalcula e valida tudo.
4. **Linguagem:** a pontuação mede o desempenho no jogo, não é avaliação clínica. Nenhum texto promete diagnóstico, tratamento ou melhora cognitiva fora do jogo. Preferências de acessibilidade não são falhas do jogador.
5. **Originalidade:** não copiar código, imagens ou mecânicas específicas de concorrentes.
6. **Interface:** só está pronta depois de verificada em telas pequenas, altura reduzida, teclado, zoom, contraste e estados de erro. Não declarar responsividade ou acessibilidade como validadas sem verificação real (aparelhos, leitores de tela).
7. **Português do Brasil** em todos os textos da interface e da documentação.
8. **Publicação:** nada de merge, deploy ou publicação sem autorização explícita do dono.

## Review guidelines

Ao revisar um pull request:

- **Escreva em português do Brasil.**
- **Separe três categorias:** fatos verificados no código (com arquivo e linha), hipóteses (o que depende de navegador, ordem de eventos ou ambiente) e recomendações.
- **Diferencie o que você executou do que apenas propõe.** Se não rodou um teste, não afirme o resultado. Diga o que rodou e com qual resultado.
- **Classifique por prioridade:**
  - **P0:** perda de dados, falha de segurança ou de isolamento entre contas, mudança indevida no banco;
  - **P1:** comportamento errado do jogo ou da pontuação, partida legítima recusada, travamento;
  - **P2:** recuperação de falhas, acessibilidade, layout, robustez;
  - **P3:** estilo e documentação.
- **Diga se cada achado exige mudança no banco.**
- **Sinalize como P0 ou P1, conforme o impacto:**
  - divergência entre o cálculo em TypeScript e o SQL;
  - escrita direta em tabelas pela API (as tabelas são somente leitura para o app; a escrita só acontece pelas funções RPC);
  - função `SECURITY DEFINER` sem `search_path` fixo ou sem checar `auth.uid()`;
  - estado de uma conta visível para outra;
  - resultado de partida que pode se perder sem aviso;
  - tentativa concluída que pode ser apagada ou repetida;
  - texto com promessa clínica.
- **Não peça** salto de versão principal de dependências, troca de framework ou criação de abstrações genéricas sem necessidade concreta.
- **Testes:** quando houver comportamento novo, aponte o teste que falharia sem a correção. Testes aleatórios devem usar semente reproduzível.
- **Seja proporcional:** prefira correções pequenas e localizadas a reescritas.
