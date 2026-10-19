# Repositório de notas no banco — 2026-10-16

## Contrato e decisões

- `src/lib/repositorio-de-notas/banco.ts` implementa `RepositorioDeNotas` sobre `nos`, `notas`, `versoes_nota`. Todas as consultas incluem o dono; RLS não basta para conexão proprietária.
- IDs bigint são projetados como texto e enviados com cast parametrizado para bigint, evitando perda de precisão. IDs inválidos retornam ausência.
- Escritas usam advisory lock transacional por usuário, precedido por `SET LOCAL lock_timeout = '5s'` e `statement_timeout = '15s'`. Não há `FOR UPDATE` coletivo: o lock coordena adoção de pasta e planejamento de ligações. O UPDATE ainda exige id, dono e revisão base.
- Mover de pasta usa `planejarMudanca`; renomear usa `planejarRenomeacao`. Cada nota alterada recebe uma única revisão e snapshot dentro da transação.
- Autosave reaproveita a última versão aberta somente para autor `usuario`. Escritas do agente criam snapshots separados e fechados, encerrando a sessão anterior. Checkpoint sem mudança fecha a sessão sem gastar revisão.
- Marca de versão combina contagem, soma das revisões e maior timestamp em uma consulta, evitando colisões em escritas dentro do mesmo milissegundo.
- Títulos: a memória usa pasta exata + `toLowerCase()` do título, sem remover acentos. Índice usa `(user_id, coalesce(pasta, ''), lower(titulo))`; diferenças Unicode extremas podem depender da collation do Postgres. A pré-checagem do banco é SQL direcionado com a mesma comparação do índice. Só `23505` com `constraint_name = notas_usuario_pasta_titulo_unico` (inclusive em `cause`) vira erro de domínio após rollback; outros erros propagam.
- Busca usa `public.portugues_sem_acento`, `vetor_busca`, `websearch_to_tsquery`, rank e headline após limitar a 50. O contrato não exige prefixos ou pasta, então não há complemento ILIKE. Diferença deliberada: memória busca substrings; Postgres faz stemming e interpreta sintaxe websearch. A validação real disso está pendente de rede.
- Configuração só importa banco dinamicamente após validar ambiente. `server-only` está fixado em 0.0.1 e é simulado nos testes de unidade.
- `src/lib/notas.ts` preserva a projeção de `revisao`; gravação de conteúdo pelo legado incrementa essa revisão e encerra sessões abertas antes do novo snapshot, invalidando o editor antigo. Colisão do índice de títulos na criação recebe mensagem de domínio em pt-BR.

## Migração e verificação

`0006_nostalgic_stepford_cuckoos.sql` é aditiva: revisao default 1 em notas, sessao_aberta default false em versoes_nota, índice único por dono/pasta/título.

O comando de migração foi tentado e saiu com código 1 sem diagnóstico. Não houve confirmação de aplicação. Integração de banco falhou no beforeAll ao criar usuário efêmero (`fetch failed`), antes de executar casos. Não houve acesso ao arquivo `.env` pelo agente: dotenv foi carregado pelos comandos/testes.

Atualização recebida no briefing de correções de 2026-10-16: M4 já foi verificado pelo usuário, migração aplicada sem duplicatas. A tentativa anterior acima é histórico; não reaplicar a migração como parte das correções.

A suíte inteira teve 905 testes aprovados e duas suítes bloqueadas por rede (41 casos não executados naquela rodada, antes de acrescentar um teste de índice). O contrato não foi alterado. Testes locais adicionais cobrem 23505 encapsulado, propagação de erros, CAS sem linhas, tags/datas, bigint e checkpoint sem mudança.

## Correções da revisão — 2026-10-16

- Criação consulta apenas pastas distintas e colisão de título. Atualização lê a nota alvo; somente mudança efetiva de pasta carrega os textos de todas as notas. Renomeação ainda precisa dos textos, sem bloqueio coletivo.
- Falha em qualquer reescrita secundária lança erro interno e cancela a transação inteira; contador de reescritas soma apenas gravações confirmadas. Testes reais injetam retorno vazio no terceiro UPDATE de nota e verificam rollback do alvo, primeira reescrita e snapshots, tanto no movimento quanto na renomeação.
- Timestamps de notas e snapshots do adaptador usam `clock_timestamp()` do Postgres. A marca ainda inclui soma das revisões. UUID do dono validado pela regex exportada de `config.ts`.
- `skipIf` da integração exige DATABASE_URL, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Com todas presentes, a tentativa real desta correção falhou no Auth (`fetch failed`): 39 casos de banco não executados. Não considerar a atomicidade real validada aqui.
- Pendências deliberadas: M3 (índice/contador da marca), B3, B4 e B5. M4 consta como já verificado no briefing; nenhuma migração executada nesta correção.
- Verificação final local desta correção: 111 testes aprovados, 39 integrações puladas com DATABASE_URL vazia apenas no subprocesso após tentativa real bloqueada. Inclui testes de notas, ingestão e versões. ESLint e diff-check passaram; TypeScript apontou apenas 9 erros nos testes concorrentes de instrução/resolução do agente e ferramentas. Sem commit/push e sem acesso manual a `.env`.
