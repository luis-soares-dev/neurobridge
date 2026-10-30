# Fundação do produto e correção do Vigia

Esta entrega mantém React, TypeScript, Vite e Supabase. **Não publica o aplicativo nem altera o banco remoto.** A migração SQL nova existe só como arquivo e foi testada num PostgreSQL local.

## Antes de colocar esta versão no ar

O app novo **só funciona com a migração 002 aplicada**, porque a função de salvar mudou de assinatura.

**Estado do banco `neurobridge` (yyxazxkqmnokdylncyph):**
- 002 **aplicada em 30/10/2026**. Conferido depois: função nova ativa, políticas somente leitura, `anon` sem acesso, dados existentes preservados.
- 003 **aplicada em 30/10/2026**. Conferido depois:
  - pontuação calculada só com inteiros;
  - `handle_new_user` não pode mais ser chamada pela API;
  - o perfil existente ganhou a linha de streak que faltava;
  - restam só os dois alertas aceitos no Advisor.
- Ainda falta o teste real com duas contas Google pelo app.

1. Reativar o projeto Supabase `neurobridge` e conferir se ele é o projeto usado pela aplicação.
2. Conferir a estrutura real contra `supabase/migrations/001_init.sql`. Não executar a 001 novamente sobre um banco existente.
3. Executar `supabase/migrations/002_server_scoring_and_rls.sql` no SQL Editor. Ela roda numa transação, pode ser repetida sem erro e substitui o antigo `scripts/save_vigia_session.sql`, aplicado ou não.
4. Executar `supabase/migrations/003_exact_scoring_and_hardening.sql` (idempotente).
   Depois, rodar o Security Advisor. Dois alertas são esperados e aceitos:
   - `save_vigia_session` executável por usuários logados (é a forma de salvar);
   - proteção de senhas vazadas desligada (o app só usa login com Google).
5. Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Nunca usar a chave service_role no frontend.
6. Teste manual com duas contas:
   - 1 sessão e 30 eventos por partida;
   - XP concedido uma única vez, mesmo reenviando;
   - cada conta vê só o próprio histórico;
   - o nível é recuperado em outro navegador;
   - falha de rede seguida de nova tentativa;
   - pausa, troca de aba e "símbolos nas cores".

## O que mudou

### Vigia: pontuação corrigida

A fórmula anterior tratava "não clicar num distrator" como um tempo de resposta fictício. Com isso, um jogador perfeito nunca subia de nível, quem não apertava nada tirava praticamente a mesma nota e responder mais rápido baixava a pontuação.

A fórmula nova, igual no app e no servidor:

- **precisão** = taxa de acertos nos azuis − taxa de respostas a outras cores (mínimo 0);
- **velocidade** = 1 − 0,5 × (tempo médio nos acertos ÷ duração do círculo no nível);
- **pontuação** = precisão × (0,6 + 0,4 × velocidade), de 0 a 1, exibida de 0 a 100.

Equivale a: pontuação = max(0, A/8 − F/22) × (1 − 0,2 × tempo médio ÷ janela). A velocidade atua como fator entre 0,8 (responder no limite) e 1,0.

Pontuação acima de 70 sobe um nível e abaixo de 40 desce um nível, comparando com três casas decimais (70,0 mantém; 70,4 sobe). **Correção de uma explicação anterior, que estava errada:** acertar 7 de 8 azuis não garante subir. Exemplos sem respostas a outras cores (A = azuis respondidos, F = respostas a outras cores):

| Situação | Pontuação | Nível |
|---|---|---|
| 8 de 8, respondendo no limite do tempo | 80,0 | sobe |
| 7 de 8, respondendo no limite do tempo | 70,0 | mantém |
| 7 de 8, respondendo em 300 ms (nível 3) | 81,7 | sobe |
| 6 de 8, respondendo em 100 ms (nível 3) | 73,3 | sobe |
| 4 de 8, respondendo no limite do tempo | 40,0 | mantém |
| 4 de 8 com 1 resposta a outra cor, no limite | 36,4 | desce |
| 3 de 8, mesmo respondendo instantaneamente | 37,5 no máximo | desce |

Não responder nada, ou responder a tudo, dá pontuação zero. Com os mesmos acertos, ser mais rápido nunca diminui a pontuação. A pontuação mede o desempenho no jogo e não é avaliação clínica; os pesos e limites ainda precisam ser calibrados com um piloto.

### Servidor como fonte oficial (migração 002)

- `save_vigia_session(id, duração_ms, nível, respostas)` recalcula pontuação, XP e próximo nível. O cliente não envia mais a pontuação.
- Recusa os seguintes casos:
  - partida mais curta que o mínimo do nível;
  - partida encerrada logo depois da anterior, o que impede gerar XP em série;
  - tempo de resposta fora da janela do círculo;
  - cores que não existem no nível;
  - respostas incoerentes.
- As tabelas ficaram **somente leitura** para o app. Não é mais possível alterar XP, inserir partidas ou apagar dados pela API. O usuário só pode editar o próprio nome e foto.
- `handle_new_user` passou a ter `search_path` fixo.
- O horário de início é calculado pelo servidor a partir da duração, o que evita erro com o relógio do aparelho.

### Experiência no Vigia (versão consolidada; detalhes na seção "Consolidação do Vigia")

- Ciclo da partida em regras puras e testadas (`src/games/vigia/session.ts`).
- Tutorial interativo, pausa coerente, salvamento recuperável, erros classificados.
- Contraste verificado automaticamente; layout testado em 12 tamanhos de tela.
- O Dashboard mostra a última e a melhor pontuação, o número de partidas e as partidas guardadas que ainda não foram enviadas.

## Consolidação do Vigia (branch `feat/vigia-consolidacao`)

Origem: revisão técnica externa de 30/10/2026, conferida achado por achado contra o código. **Nenhuma mudança de banco e nenhuma mudança de pontuação, XP ou dificuldade.**

**Ciclo da partida** ([session.ts](src/games/vigia/session.ts), [useVigiaGame.ts](src/games/vigia/useVigiaGame.ts))
- Fases explícitas: contagem, apresentação, exposição, intervalo, pausa e concluída.
- Uma tentativa concluída nunca é apagada.
- Pausar com um círculo na tela descarta só aquela tentativa e devolve o estímulo ao conjunto restante, que é reembaralhado. A partida continua com 30 tentativas e 8 alvos. Exceção conhecida: se for o último estímulo, ele volta. O reembaralhamento evita a repetição imediata, mas **não é proteção contra manipulação de desempenho**: ainda é possível pausar durante um estímulo para descartá-lo.
- Pausar no intervalo guarda quanto falta dele. Ao continuar, o jogo termina esse intervalo antes do próximo estímulo, e, se não houver mais estímulos, a partida termina. Pausar não encurta intervalos nem o tempo ativo. (Correção da revisão do PR #3: antes, a retomada sempre ia para um novo estímulo, o que fazia o jogo travar no intervalo final e permitia ficar abaixo do tempo mínimo aceito pelo servidor.)
- A tentativa só começa depois de dois quadros de animação (`requestAnimationFrame`). O primeiro marca o início do tempo; o segundo indica que o navegador seguiu renderizando. É uma aproximação: não certifica que os pixels chegaram à tela. Se não houver quadro em 300 ms, a partida pausa sozinha (interrupção técnica) em vez de registrar omissão.
- Resposta depois do fim da janela é recusada, não puxada para o limite.
- Botão Responder: aceita só o botão principal do mouse e funciona com `onClick` para teclado e leitores de tela, sem contar o mesmo toque duas vezes.

**Duração**
- O app envia só o **tempo ativo** (sem contagem regressiva e sem pausas). Pausas longas não fazem mais a partida ser recusada pelo limite de 1 hora.
- O banco não mudou. A coluna `started_at` continua sendo "agora − tempo ativo", e não o início real com pausas.

**Salvamento recuperável** ([pendingResults.ts](src/games/core/pendingResults.ts), [errors.ts](src/services/errors.ts))
- A partida é guardada neste aparelho, por conta, **antes** do envio, com validade de 7 dias. A tela sabe na hora se há cópia recuperável. Ela sai de lá só depois da confirmação do servidor.
- No máximo 10 partidas guardadas. Com a fila cheia, a nova partida **não** é guardada, nenhuma das anteriores é apagada e a tela avisa. (Antes, a mais antiga era descartada sem aviso.)
- Cada registro guardado tem versão e é validado por inteiro (jogo, ID, data, resumo, dados e coerência do ID). Registros ilegíveis ficam isolados, não travam a tela, e o Dashboard oferece "Limpar registros ilegíveis".
- O Dashboard oferece "Enviar agora" para partidas pendentes e mostra até quando cada uma fica guardada. O reenvio usa o mesmo ID, sem duplicar XP.
- Erros classificados: sem conexão, tempo esgotado (15 s), sessão expirada, sequência rápida demais, recusada pelo servidor e resposta inesperada. Cada um tem mensagem e ação próprias. Partida recusada oferece "Descartar", não "tentar de novo".
- A resposta do servidor é validada (intervalos, inteiros, mesmo ID). `null` não vira mais zero.
- O roteador mudou para `createBrowserRouter`, para usar `useBlocker`. Recarregar, fechar, voltar ou navegar pedem confirmação durante a partida **e** na tela de resultados quando o resultado não foi confirmado pelo servidor nem guardado neste aparelho.

**Contraste e layout** ([index.css](src/index.css))
- Novos tokens:
  - `--primary-strong` (botão principal, 4,91:1) e `--respond` (Responder, 5,17:1);
  - `--subtle` mais claro e `--control-border` (bordas de controle, 3:1 ou mais);
  - símbolo escuro sobre todos os círculos.
- As cores dos estímulos não mudaram.
- Exemplos de cores com quebra de linha.
- Arena com estímulo e botão lado a lado em telas baixas.
- Botão "Começar" preso à borda inferior quando a tela é baixa.
- Áreas seguras de celulares com recorte; layout em duas colunas em telas largas e em paisagem; texto informativo com no mínimo 0,8rem; controles com no mínimo 44 px.

**Tutorial e acessibilidade** ([Tutorial.tsx](src/games/vigia/Tutorial.tsx))
- Três passos: azul responde; outra cor espera; treino de 6 círculos mais lento, sem XP e sem salvar. Pode pular e repetir.
- Aparece na primeira vez e depois fica em "Como jogar".
- O som pergunta antes de tocar; fica desligado até a escolha.
- Símbolos nas cores disponíveis também na pausa. A instrução cita a estrela quando os símbolos estão ativos.
- O foco vai para o título a cada nova tela. A contagem é anunciada uma vez, sem interromper.

**Isolamento por conta**
- A área logada é desmontada ao trocar de conta (`AuthGuard` com chave por conta).
- O Dashboard recomeça do zero a cada leitura.
- Um evento de login mais recente não é sobrescrito pela leitura inicial atrasada da sessão.

**Comunicação da pontuação**
- A pontuação aparece com uma casa decimal quando necessário (70 mantém; 70,4 sobe), e a decisão de nível é explicada com os números exatos.
- A descrição vem de acertos, outras cores e tempo, e não diz "rápido" quando a pessoa respondeu no limite.
- "Precisão" passou a se chamar "Índice de resposta", com a definição na tela.
- O XP aparece como "XP de participação".

**Testes**
- `supabase/tests`: cada grupo tem o próprio banco. A cadeia 001 → 002 → 003 é reaplicada e comparada ao estado final. Os sorteios usam semente (`TEST_SEED`), mostrada no título do grupo.
- E2E com Playwright (`npm run e2e`, também na CI). O Supabase é simulado pela interceptação de rede. Cobre:
  - matriz de 12 tamanhos de tela em todas as telas do percurso;
  - tutorial e partida só com teclado;
  - pausa e troca de aba;
  - tempo ativo enviado;
  - sem conexão seguido de recuperação pelo Dashboard;
  - partida recusada; sessão expirada;
  - voltar no meio da partida;
  - troca de conta em outra aba.
  - pausa no intervalo final, com partida salva e tempo ativo acima do mínimo;
  - saída sem cópia recuperável (voltar, botão e fechar a aba pedem confirmação);
  - fila cheia sem apagar partidas guardadas; registro ilegível sem derrubar o Dashboard.
- Ciclo da partida: 1.500 partidas simuladas com pausas e falta de quadro em pontos sorteados (5 níveis × 300). Em todas: 30 tentativas, 8 alvos, nenhum estímulo vazio e tempo ativo acima do mínimo do servidor. Contraprova: os 8 testes novos falham no código anterior.

### Critérios de tela (verificados automaticamente em `e2e/layout.e2e.ts`)

Tamanhos: 320×568, 360×640, 375×667, 390×844, 768×1024, 1024×768, 1280×800, 1440×900, paisagem 667×375 e 844×390, e equivalentes de zoom 640×360 (1280×720 a 200%) e 320×256 (1280×1024 a 400%).

Em todas as telas (login, Dashboard, tutorial, instruções no nível 10, arena, pausa, resultados e resultados com erro):
- sem rolagem horizontal; nenhum elemento fora da tela ou vazando da caixa;
- controles com pelo menos 44×44 px (o rótulo conta como alvo do campo);
- texto com pelo menos 0,8rem.

Na arena, em todos os tamanhos, o círculo e o botão Responder ficam inteiros na tela, sem rolar. Nas instruções, em paisagem e com zoom, o botão "Começar" fica visível sem rolar.

**Não verificado (exige aparelhos ou pessoas):** Safari no iPhone, Chrome no Android, VoiceOver e TalkBack, zoom real do navegador (o teste usa o tamanho equivalente em pixels CSS) e login real com Google.

### Organização do código

```
src/app/            rotas
src/features/       auth (login, guarda de rota), dashboard
src/games/core/     o que todos os jogos compartilham: dificuldade, pontuação/XP, preferências, áudio, telas comuns
src/games/vigia/    config.ts (parâmetros), engine.ts (regras puras), useVigiaGame.ts (relógio), VigiaGame.tsx (telas)
src/games/catalog.ts  lista de jogos exibida no Dashboard
src/services/       único acesso ao Supabase
src/ui/             componentes visuais básicos; tokens de cor em src/index.css
supabase/tests/     testes da migração num PostgreSQL local (PGlite)
```

Para criar um jogo novo: crie `src/games/<id>/` com config, engine (e seus testes), hook e telas; registre-o em `catalog.ts` e em `App.tsx`; e crie a função SQL de salvamento com um teste de paridade.

### Ferramentas

- ESLint configurado.
- CI no GitHub Actions: typecheck, lint, testes e build.
- `npm run check` roda tudo localmente.
- Vite 5.4.21 e Vitest 2.1.9 com as correções de segurança.

## Verificação realizada

- `npm run check`: typecheck, lint, todos os testes e build passaram.
- Testes do motor do Vigia, para os 10 níveis:
  - jogador perfeito sobe de nível;
  - quem não responde, ou responde a tudo, desce;
  - responder mais rápido nunca baixa a pontuação;
  - a pontuação fica sempre entre 0 e 1.
- Testes da migração 002 em PGlite, com Auth simulado, usando os arquivos SQL reais sem alteração:
  - paridade exata app × servidor em 300 partidas aleatórias, mais o caso de meio milésimo. A conta é feita só com inteiros nos dois lados; num teste de estresse com 5.000 partidas não houve nenhuma divergência;
  - idempotência e limite do histórico em 30;
  - recusas de partidas inválidas;
  - isolamento entre contas;
  - bloqueio de escrita direta.
- Contraprova: sem a migração 002, o mesmo teste consegue alterar XP diretamente.
- **Ainda pendentes:** aplicar e testar no Supabase real, OAuth real e teste com usuários.

## Limites conhecidos

- As respostas ainda vêm do navegador. O servidor recusa partidas impossíveis e limita o ritmo, mas um robô que simule respostas plausíveis em tempo real ainda ganharia XP. Rankings competitivos exigiriam mais controle, como sessões iniciadas pelo servidor.
- Partidas antigas foram salvas com a fórmula anterior. A primeira sugestão de nível depois da atualização pode usar essa pontuação antiga.
- A sequência de dias (streak) ainda não é atualizada.
- O XP de participação existe mesmo sem nenhuma resposta (65 a 110 por partida). É uma decisão consciente, a reavaliar depois do piloto; mudar a fórmula exige migração.
- Interrupções (pausas, falta de quadro) não são registradas no banco; o melhor resultado e o histórico não separam nível, apoios usados nem versão da regra.
- A partida guardada neste aparelho não é protegida contra adulteração; o servidor revalida tudo ao receber.
- Dependências: `npm audit` (30/10/2026) aponta 12 avisos. Em produção são 5: `react-router-dom` 6.26.0 (alto; corrigido na 6.30.6) e `@supabase/supabase-js` (baixo; corrigido na 2.118). Em desenvolvimento são 7: Vite, esbuild e Vitest (inclui 2 críticos; exigem salto de versão principal). Tratamento previsto em PR separado.

Próxima entrega: jogo Lente (memória de trabalho), usando a estrutura de `src/games/core`.
