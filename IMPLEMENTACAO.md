# Fundação do produto e correção do Vigia

Esta entrega mantém React, TypeScript, Vite e Supabase. **Não publica o aplicativo nem altera o banco remoto.** A migração SQL nova existe só como arquivo e foi testada num PostgreSQL local.

## Antes de colocar esta versão no ar

O app novo **só funciona com a migração 002 aplicada**, porque a função de salvar mudou de assinatura.

1. Reativar o projeto Supabase `neurobridge` e conferir se ele é o projeto usado pela aplicação.
2. Conferir a estrutura real contra `supabase/migrations/001_init.sql`. Não executar a 001 novamente sobre um banco existente.
3. Executar `supabase/migrations/002_server_scoring_and_rls.sql` no SQL Editor. Ela roda numa transação, pode ser repetida sem erro e substitui o antigo `scripts/save_vigia_session.sql`, aplicado ou não.
4. Rodar o Security Advisor do Supabase e conferir se não há alertas novos.
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

Pontuação acima de 70 sobe um nível e abaixo de 40 desce um nível. Na prática, quem responde a 7 dos 8 azuis sem errar outras cores sobe, e quem perde 5 ou mais azuis desce. Não responder nada, ou responder a tudo, dá precisão zero. Com a mesma precisão, ser mais rápido nunca diminui a pontuação. A pontuação mede o desempenho no jogo e não é avaliação clínica.

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

### Experiência no Vigia

- Pausa com botão, tecla Esc ou automática ao trocar de aba. A tentativa em andamento é repetida ao continuar.
- O tempo de resposta conta a partir do quadro em que o círculo aparece na tela.
- Opção de desligar o som e opção de "símbolos nas cores" para quem confunde cores.
- Aviso antes de fechar a página com partida em andamento ou não salva.
- Textos em português do Brasil, contraste maior nos textos secundários, foco visível no teclado e resposta imediata ao toque.
- O Dashboard mostra a última e a melhor pontuação e o número de partidas.

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
  - paridade exata app × servidor em 40 partidas aleatórias;
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

Próxima entrega: jogo Lente (memória de trabalho), usando a estrutura de `src/games/core`.
