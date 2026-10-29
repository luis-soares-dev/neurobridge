# Vigia: salvamento e progresso por conta

Esta entrega mantém React, TypeScript, Vite e Supabase. Não publica o aplicativo nem altera o banco remoto.

## Antes de colocar esta versão no ar

1. Reativar o projeto Supabase `neurobridge` e conferir se ele é o projeto usado pela aplicação.
2. Verificar a estrutura real: a implementação usa as tabelas de `supabase/migrations/001_init.sql`. Não executar novamente a migração inicial sobre um banco existente.
3. Após conferir as tabelas, executar `supabase/scripts/save_vigia_session.sql` no SQL Editor. O script adiciona uma função transacional, com permissões de execução apenas para usuários autenticados, usando as políticas RLS existentes.
4. Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente da aplicação. Não usar chave de serviço no frontend.
5. Fazer uma partida de teste com duas contas: conferir 1 sessão e 30 eventos, XP concedido uma única vez, histórico individual e recuperação da dificuldade em outro navegador. Simular falha de rede e repetir o envio.

Sem a função SQL, o app informa falha ao salvar e permite repetir; não declara sucesso falso. Não fazer merge/deploy antes de aplicar e validar o SQL no ambiente correto.

## Comportamento

- Cada partida recebe um UUID ao começar. Reenvios usam o mesmo UUID.
- Sessão, 30 eventos, XP e agregado do progresso são salvos na mesma transação. Erros desfazem a operação inteira.
- Uma trava no perfil serializa envios simultâneos da mesma conta. Reenvio de uma partida concluída retorna sem conceder XP novamente.
- Eventos guardam ordem, cor e resultado em `event_type`, além do tempo e dificuldade nas colunas existentes. O horário do evento é o horário do salvamento, não o instante de apresentação do estímulo.
- O nível sugerido é recuperado da última sessão concluída da conta. O cache local é separado por ID do jogador e usado como alternativa quando o histórico está indisponível.
- Falhas exibem aviso e botão de nova tentativa. A partida permanece na memória da tela; fechar ou recarregar a página antes de salvar perde esse resultado. Existe saída explícita sem salvar.
- O K-Score é uma pontuação do jogo, sem interpretação clínica ou promessa de transferência para a vida cotidiana.

## Verificação realizada

- `npm test -- --run`: testes de separação de contas, limites de dificuldade, armazenamento bloqueado, envio confirmado, erro do banco e mudança de conta antes do envio.
- `npm run build`: TypeScript e compilação de produção.
- SQL executado em PostgreSQL local via PGlite, com Auth simulado: gravação de eventos, repetição sem duplicação, XP, limite de 30 resultados no agregado, rejeição de partida incompleta e isolamento de contas com RLS. Para esse teste local, a extensão uuid-ossp foi substituída por gen_random_uuid; o script novo foi executado sem alteração.
- Ainda pendentes: teste no Supabase real, OAuth e verificação visual no navegador.

## Limites desta etapa

A pontuação ainda é calculada no cliente e não constitui um sistema antifraude. As permissões existentes permitem que o dono altere seus registros; rankings competitivos exigirão validação no servidor e revisão dessas permissões. A integridade transacional do fluxo normal não equivale a proteção contra adulteração intencional.

Próxima entrega: jogo Lente, após a validação do salvamento online.
