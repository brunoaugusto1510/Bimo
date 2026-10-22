# Bimo — Wiki Viva integrada: funcionamento e operação

Implementação de backend e agente em feat/estrutura-llmwiki, em 22/10/2026. Telas e design ficam com o usuário e o Claude. Este documento descreve o código; não confirma ativação no banco ou avaliação com modelos reais.

## Comportamento

- Criar, editar, renomear, mover ou importar notas registra trabalho na mesma transação da escrita, quando a automação está habilitada. Escritas do agente passam pelo mesmo ciclo.
- Autosaves próximos consolidam a revisão mais recente, com 90 segundos de estabilidade (`ESTABILIDADE_DA_WIKI_SEGUNDOS`). A gravação não espera a inferência. Renomear, mover, etiquetar e reescrever ligações não reprocessam a nota: o trabalho só acompanha a nova revisão.
- O executor reconcilia até 50 notas anteriores por rodada. Cada chamada HTTP processa um trabalho; a fila e o progresso sobrevivem a reinícios.
- O modelo recebe um trecho da nota, até seis candidatas e um índice compacto de sínteses (id, título e aliases). Pode propor até três conceitos, enriquecer uma síntese ou não alterar nada.
- As candidatas vêm dos termos característicos da nota: o que ela repete e o que está no título (palavras comuns saem; siglas como TCP ficam), pesado pela raridade no acervo, que é medida pela própria busca (um termo achado em 20 notas ou mais vale como comum). Dez termos são consultados, até vinte se os mais salientes só existirem na própria nota. Notas e sínteses (também pelo título e aliases) competem na mesma pontuação, e as dependentes desatualizadas por esta origem entram primeiro, em ondas de três.
- O índice lista as sínteses mais próximas da nota primeiro, até 120 entradas ou 12.000 caracteres; se `total` passar das entradas, o prompt avisa que é parcial. Com ele o modelo reconhece um conceito que a busca não trouxe e escolhe o `alvoId` para enriquecê-lo. O servidor aceita um alvo só do índice quando o título proposto tem palavras em comum com o dele, e revalida existência, proteção, citações e revisões; ainda assim, o modelo só leu o título e os aliases, e uma escolha errada com o título certo não é detectável sem uma segunda avaliação.
- Notas derivadas pertencem à base normal e adotam inicialmente a pasta da origem. Metadados identificam seu papel; nenhuma pasta ou tag tem significado privilegiado.
- Evidências sempre chegam às anotações pessoais. Sínteses mais abrangentes podem reaproveitar raízes de outras sínteses, sem contá-las como fontes independentes.
- O servidor valida cada proposta e cada afirmação separadamente: uma citação sem suporte derruba a afirmação, e uma proposta malformada ou sem afirmações sustentadas é descartada, sem perder o resultado pago das demais. A comparação tolera espaços, aspas tipográficas e ênfase, guarda o trecho original e exige no mínimo 12 caracteres (salvo a entrada inteira). Renomear ou mover outra nota (que reescreve ligações) não desatualiza a síntese: a comparação das origens ignora para onde as ligações apontam, e as citações são relocalizadas no texto atual. Valida também snapshots, revisões, identidade, gerenciamento e posse do trabalho. Títulos recebem `/` e `` trocados por hífen, e um título já ocupado na pasta vira "<título> (síntese)". Só então publica nota, histórico, evidências, conceito e progresso em uma transação curta.
- Alterar uma origem deixa as sínteses dependentes desatualizadas até revalidação. Elas são processadas em ondas limitadas; dependentes ainda pendentes impedem declarar a origem concluída.
- A busca do agente inclui conhecimento por alias, citações atuais e cobertura. Ler uma nota pede seu processamento sem que uma falha da fila impeça a leitura; a busca não pede nada por resultado, porque a reconciliação já alcança toda nota sem trabalho; a própria pergunta ou a resposta do chat não vira evidência nova.

As ferramentas normais de escrita continuam exigindo pedido do usuário. A manutenção automática tem um publicador próprio, limitado às sínteses gerenciadas, sem autorização para reescrever notas pessoais.

## Ativação no ambiente escolhido

1. Revise as migrações 0007_wiki_viva, 0008_wiki_automatica e 0009_wiki_ultimo_erro e faça o backup aplicável ao ambiente. Use o fluxo de migração existente (`npm.cmd run db:migrate`) somente no banco escolhido para ativação.
2. Configure no servidor:

   ```dotenv
   WIKI_VIVA_ATIVA=1
   WIKI_AUTOMATICA_ATIVA=1
   WIKI_TETO_TOKENS_DIA=200000
   WIKI_EXECUTOR_SEGREDO=<segredo-exclusivo-com-32-ou-mais-caracteres>
   BIMO_URL=http://localhost:3000
   ```

   OPENAI_API_KEY e OPENAI_MODEL são os já usados pelo chat. O executor usa HTTPS fora de localhost. Não reutilize o segredo de sessão e não exponha o segredo do executor no cliente.

3. Reinicie a aplicação: as capacidades do repositório são instanciadas e ficam em cache, e a existência das tabelas (e da coluna `ultimo_erro` da 0009) é sondada uma vez por processo. Com as variáveis ligadas e as migrações ausentes, as notas continuam sendo gravadas e lidas, a wiki fica vazia e a fila não faz nada; aplicar as migrações depois exige reiniciar.
4. Em outro processo, com a aplicação acessível, execute:

   ```powershell
   npm.cmd run wiki:executar
   ```

   Em hospedagem, mantenha esse processo sob o supervisor da infraestrutura escolhida. Para uma rodada controlada, use `npm.cmd run wiki:executar -- --uma-vez`.
5. O executor chama POST /api/wiki/processar com um bearer exclusivo, a cada dez segundos após terminar a rodada anterior. Não aceita userId ou conteúdo proposto pelo cliente. Usa o dono configurado pelo servidor, conforme a arquitetura de autenticação atual do Bimo.

Há aceleração oportunista com after() após gravações e conversas. Ela não substitui o executor independente: uma função encerrada pela plataforma deixa o trabalho para retomada posterior.

Os valores do exemplo são limites conservadores para um piloto, sem evidência de ajuste ótimo. Ativação pode iniciar processamento das notas anteriores e chamadas pagas à OpenAI. Os arquivos foram preparados sem executar essa ativação.

## Persistência e concorrência

- paginas_wiki conserva snapshots e afirmações por publicação, separados das versões mutáveis de autosave.
- conceitos_wiki identifica a síntese atual, aliases, revisões das raízes e revisão ainda gerenciada. Há unicidade de conceito por dono.
- trabalhos_wiki funciona como outbox e fila. Registra revisão, geração, cursor, tentativas, disponibilidade e posse temporária.
- consumos_wiki registra reserva, consumo confirmado/incerto, modelo e versão do pipeline. Apagar uma origem não devolve crédito já gasto.
- Cada query filtra o dono explicitamente, inclusive com conexão privilegiada. Constraints compostas impedem trabalhos/conceitos associados a notas de outro dono; RLS acrescenta defesa.
- As políticas RLS das três tabelas operacionais permitem somente leitura ao papel authenticated. Clientes não podem alterar reservas, fila ou gerenciamento diretamente; escritas passam pelo backend.
- A posse dura 120 segundos e a geração invalida resultados antigos. Escritas usam a trava transacional do dono e revisões otimistas. A chamada ao modelo acontece fora de transações.
- A migração 0008 cria o índice único de nota/dono antes das foreign keys que o referenciam. A ordem gerada foi ajustada e testada em Postgres local.

O desenho foi verificado com as referências de [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) e [bloqueio de linhas do PostgreSQL](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE), consultadas em 22/10/2026.

## Consumo e falhas

O teto é por dono e dia UTC, em tokens, separado das chamadas normais do chat. Não é um teto em reais. A reserva usa um limite conservador de bytes do payload mais margem de instruções/schema e saída máxima; isso não é apresentado como medição de tokenização. A resposta do provedor confirma os tokens efetivos quando disponíveis.

Timeout, conexão perdida ou resposta sem medição mantém a reserva comprometida. Recusas 4xx do provedor e cancelamentos antes do envio não são cobrados e liberam a reserva; respostas incompletas, recusadas ou ilegíveis confirmam o uso real informado. Um dono processa um trabalho por vez, e as rodadas oportunistas após gravações são limitadas a uma por vez e uma a cada 30 segundos por processo. O sistema não promete cobrança externa exatamente uma vez. Repetir a publicação, porém, exige posse e geração válidas e não duplica a conclusão já persistida.

| Estado/situação | Comportamento |
| --- | --- |
| pendente | Aguarda estabilidade, orçamento ou outra rodada |
| concluido | Trechos e dependentes elegíveis daquela revisão foram processados; não implica que toda inferência está correta |
| temporario | Três falhas transitórias sem progresso; exige retomada operacional |
| revisar | Resposta incompleta, recusada ou ilegível, recusa 4xx do provedor, limite editorial ou edição protegida; não se repete sozinho |
| configuracao | Falha de autenticação/configuração interrompe a fila daquele dono |
| Orçamento insuficiente | Sem chamada e sem gastar tentativa; o trabalho aguarda o próximo dia UTC e o executor consulta a cada 30 minutos |

Depois de corrigir autenticação/configuração ou uma falha transitória, a operação explícita `npm.cmd run wiki:executar -- --uma-vez --retomar` retoma trabalhos em configuracao/temporario e os que pararam em revisar por erro do provedor (`ultimo_erro` começando por `ErroOpenAI:`, como modelo ou schema recusados). Ela não remove proteção editorial nem reabre os demais trabalhos em revisar.

O executor para em 401/403/503 de sua própria rota ou após cinco falhas consecutivas de comunicação. Mensagens e logs não incluem notas, citações, prompts, chaves ou corpo de erro do provedor: registram só a categoria da falha (nome, status HTTP e SQLSTATE), guardada também em `trabalhos_wiki.ultimo_erro`, e o executor imprime o motivo do adiamento.

## Edição manual e contratos para a futura interface

Editar o conteúdo de uma síntese protege-a. Renomear/mover pelas operações próprias conserva identidade e não libera uma edição já protegida. Uma edição feita com a automação desligada também é detectada pela divergência da revisão gerenciada após reativação.

POST /api/wiki/gerenciamento exige sessão, mesma origem e JSON com notaId, revisaoBase e gerenciada. A revisão desatualizada responde 409. Definir gerenciada=false protege a síntese; definir true explicitamente permite ao compilador voltar a atualizá-la e reabre suas origens na fila. Essa decisão pode substituir o texto editado na próxima publicação; a futura interface deve comunicar essa consequência.

A rota administrativa de processamento exige bearer específico ou sessão com mesma origem. O bearer só é aceito pelo proxy em POST /api/wiki/processar; não libera notas, chat nem gerenciamento.

O protótipo manual (página `/wiki`, `POST /api/wiki`, compilação por seleção de notas e o link no cabeçalho) foi removido: nenhum caminho de inferência existe fora da fila e do orçamento persistente. `GET /api/wiki` continua como leitura (índice e, com `id`, a síntese, seu estado e as evidências das origens acessíveis) para a interface a ser definida com o Claude. O repositório não oferece escrita direta de sínteses; só `automacao.concluir` publica.

## Limites e avaliação

- Recuperação inicial é textual e por aliases/dependências. Não há vetores nem garantia de recuperar todas as conexões possíveis.
- Trechos têm até 8.000 unidades UTF-16, sem separar par substituto; o cursor percorre o documento inteiro. Candidatas e payload são limitados; o restante da nota não é declarado processado prematuramente.
- Até dez raízes, 72 afirmações acumuladas e três propostas por rodada limitam crescimento. Excesso pede revisão/divisão. Dependentes que o modelo viu e não alterou ficam avaliadas para a revisão da origem (as marcadas `desatualizadaPelaOrigem` no payload); uma atualização proposta e descartada não conta como avaliada. Só ondas sem progresso (nenhuma atualização de dependente, avaliação ou avanço do cursor) contam como tentativa, com espera entre elas; publicar conceitos novos não conta como progresso.
- Citações literais validam localização, não sustentação lógica. Hipóteses/opiniões/divergências dependem também de boa geração e avaliação humana.
- A implementação não acrescenta exclusão de notas. Se uma origem for removida ou deixar de ser acessível, suas citações não são devolvidas como evidências atuais. Uma futura operação de exclusão precisa definir o expurgo dos snapshots/históricos derivados conforme a política de retenção.
- O piloto com corpus aprovado e modelo real, a medição de qualidade/custo e a validação na infraestrutura Supabase hospedada permanecem etapas de ativação. Testes locais não as substituem.

A geração segue [Structured Outputs na Responses API](https://developers.openai.com/api/docs/guides/structured-outputs), consultado em 22/10/2026, com schema estrito e validações adicionais do Bimo. store=false é reaproveitado do transporte existente e não garante retenção geral zero pelo provedor.

## Verificação local

```powershell
npx.cmd vitest run --exclude '.claude/worktrees/**' --exclude 'src/lib/repositorio-de-notas/banco.test.ts' --exclude '**/*.integration.test.ts' --maxWorkers=3
npx.cmd tsc --noEmit
npx.cmd eslint src scripts
git diff --check
```

Os testes de persistência novos usam PGlite 0.5.11, um Postgres descartável em memória, e executam os arquivos SQL 0007 a 0009 sobre um substrato local anterior à wiki. Verificam rollback, revisões, posse, reservas, constraints e RLS com dois donos fictícios. Não leem .env, não usam USER_ID_PADRAO e não acessam Supabase ou modelos reais. A conexão única do PGlite não comprova contenção entre conexões físicas de um pool remoto.

Validação em 22/10/2026, após a revisão independente (ECC e Codex) e as correções dos bloqueadores: 1.862 testes passaram em 154 arquivos na suíte offline; TypeScript sem emissão, ESLint de src/scripts, sintaxe do executor e git diff --check passaram. As correções partiram de reproduções que falhavam (regressões em memória em `regressoes.test.ts`) e ganharam testes no Postgres local (`persistencia.test.ts`, `sem-migracao.test.ts`); seis delas foram conferidas quebrando a correção de propósito. As leituras e buscas do agente seguem funcionando quando a wiki falha (tabela ausente, timeout), sem o contexto da wiki. Os testes de SQL rodam em PGlite com uma conexão só, o que não comprova contenção entre conexões de um pool remoto. Integrações remotas, execução da aplicação no navegador e inferência real não foram executadas, e a migração 0009 não foi aplicada em nenhum banco.
