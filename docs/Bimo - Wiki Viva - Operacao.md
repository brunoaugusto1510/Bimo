# Bimo — Wiki Viva integrada: funcionamento e operação

Implementação em feat/estrutura-llmwiki, atualizada em 23/10/2026. Backend e dados das telas estão implementados; o usuário autorizou incluir as telas e enviará a referência visual antes dessa etapa. Este documento descreve o código; não confirma ativação no banco ou avaliação com modelos reais.

## Comportamento

- Criar, editar, renomear, mover ou importar notas registra trabalho na mesma transação da escrita, quando a automação está habilitada. Escritas do agente passam pelo mesmo ciclo.
- Autosaves próximos consolidam a revisão mais recente, com 90 segundos de estabilidade (`ESTABILIDADE_DA_WIKI_SEGUNDOS`). A gravação não espera a inferência. Renomear, mover, etiquetar e reescrever ligações não reprocessam a nota: o trabalho só acompanha a nova revisão.
- O executor reconcilia até 50 notas anteriores por rodada. Cada chamada HTTP processa um trabalho; a fila e o progresso sobrevivem a reinícios.
- O modelo recebe um trecho da nota, até seis candidatas e um índice compacto de sínteses (id, título e aliases). Pode propor até três conceitos, enriquecer uma síntese ou não alterar nada.
- As candidatas vêm dos termos característicos da nota: o que ela repete e o que está no título (palavras comuns saem; siglas como TCP ficam), pesado pela raridade no acervo, que é medida pela própria busca (um termo achado em 20 notas ou mais vale como comum). Dez termos são consultados, até vinte se os mais salientes só existirem na própria nota. Notas e sínteses (também pelo título e aliases) competem na mesma pontuação, e as dependentes desatualizadas por esta origem entram primeiro, em ondas de três.
- O índice lista as sínteses mais próximas da nota primeiro, até 120 entradas ou 12.000 caracteres; se `total` passar das entradas, o prompt avisa que é parcial. Com ele o modelo reconhece um conceito que a busca não trouxe e escolhe o `alvoId` para enriquecê-lo. O servidor aceita um alvo só do índice quando o título proposto tem palavras em comum com o dele, e revalida existência, proteção, citações e revisões; ainda assim, o modelo só leu o título e os aliases, e uma escolha errada com o título certo não é detectável sem uma segunda avaliação.
- Notas derivadas pertencem à base normal e nascem na pasta **Neurônios**, por decisão do usuário em 23/10. Sínteses existentes mantêm a organização atual; mover ou renomear continua permitido. O papel de neurônio vem dos metadados, e uma nota pessoal nessa pasta continua pessoal.
- Cada afirmação de uma síntese tem um id estável (hash do texto e das evidências, sem a posição do trecho), e o modelo vê o id das afirmações das candidatas (até 24, as da origem primeiro, com o total e o limite de 72). Ao enriquecer, uma proposta tem três operações: `afirmacoes` acrescenta, `substituicoes` troca uma afirmação por id e `retiradas` remove por id. O que nenhuma operação cita é mantido, desde que a evidência ainda exista; reapresentar uma afirmação que já existe não a duplica. O servidor só aceita retirar ou substituir os ids que mostrou e valida a evidência da substituição (se falhar, a afirmação antiga fica). As afirmações cuja nota de origem mudou aparecem primeiro, marcadas como `desatualizada`; só essas podem ser retiradas sozinhas. Retirar o que continua sustentado exige uma afirmação nova ou substituta na mesma proposta, e há um teto de remoções ou trocas dessas por proposta (um quarto da síntese, no mínimo três). Trocar uma afirmação por algo que a síntese já tem é ignorado, para a repetição não colapsar a síntese em ondas. Reapresentar uma afirmação existente não a duplica nem muda sua natureza (uma inferência não vira fato); uma citação guardada só vale se o trecho ainda está no texto atual da nota. A proposta que deixaria a síntese vazia é recusada, e a que não muda nada, ou a que vem sem nenhuma operação para uma síntese existente, é uma decisão de não mudar: a síntese conta como avaliada, sem nova revisão. Uma dependente com mais de 24 afirmações desatualizadas não conta como avaliada, porque o modelo só vê 24 por chamada: após três ondas sem progresso o trabalho para para revisão, em vez de dar a síntese como em dia.
- Um neurônio pode se ligar a outros neurônios. A proposta do modelo traz `ligacoes` (ids de sínteses que ele viu no índice ou nas candidatas, no máximo oito); o servidor ignora o id que não é de uma síntese existente, que o modelo não viu, ou que é a própria síntese. As ligações ficam guardadas em `paginas_wiki.estrutura` e aparecem no texto como uma seção "Neurônios relacionados" com `[[links]]`, e é desse texto que o grafo deriva as arestas (nada é espelhado em outra tabela). Ligar não é evidência: não vira origem nem torna o neurônio desatualizado quando o ligado muda, não altera o neurônio ligado e não cria link de volta. Um neurônio editado por você pode ser ligado por outros, mas o Bimo continua sem escrever nele. Ao enriquecer, as ligações existentes ficam e as novas se somam; renomear um neurônio ligado reescreve o link pelo caminho normal e a próxima atualização usa o nome novo.
- As perguntas em aberto (`lacunas`) também ficam guardadas em `estrutura`: o modelo devolve a lista completa, e uma lista vazia, numa síntese que já existe, mantém as atuais.
- `ligacoesRetiradas` permite liberar vagas sem editar o texto à mão: só retira ligações que o modelo viu na candidata. A retirada prevalece se o mesmo id também vier em `ligacoes`.
- `divergencias` guarda pares de afirmações com o contexto de cada lado. O servidor resolve ids visíveis e referências `nova:1`, `nova:2` etc. para ids estáveis, preserva pares anteriores e remove pares quando alguma afirmação deixa de existir. Eles também aparecem no markdown em “Onde suas notas divergem”.
- A cada rodada, antes de reivindicar trabalho, uma verificação local inspeciona até 20 sínteses, priorizando as há mais tempo sem diagnóstico (intervalo de um dia por síntese). Detecta origens ausentes, divergências, possíveis duplicatas por títulos/aliases normalizados, novidades relacionadas a sínteses protegidas e ligações quebradas. Não chama o modelo, não une duplicatas nem altera notas pessoais. A busca de novidades usa até três termos por síntese protegida e pode deixar relações fora do recorte.
- O diário registra nascimento/crescimento na mesma transação da publicação. Também registra leitura sem novidade sustentada, entrada de notas anteriores na fila, energia insuficiente e situações que precisam de atenção. Chaves idempotentes e assinatura de diagnóstico evitam repetir o mesmo alerta a cada rodada.
- Links gerados para a raiz são explícitos (`[[/Título]]`), evitando homônimas em outras pastas. Delimitadores em pastas existentes são codificados em caminhos absolutos, sem proibir ou renomear as pastas da pessoa. O resolvedor e as reescritas de links entendem esses caminhos.
- Evidências sempre chegam às anotações pessoais. Sínteses mais abrangentes podem reaproveitar raízes de outras sínteses, sem contá-las como fontes independentes.
- O servidor valida cada proposta e cada afirmação separadamente: uma citação sem suporte derruba a afirmação, e uma proposta malformada ou sem afirmações sustentadas é descartada, sem perder o resultado pago das demais. A comparação tolera espaços, aspas tipográficas e ênfase, guarda o trecho original e exige no mínimo 12 caracteres (salvo a entrada inteira). Renomear ou mover outra nota (que reescreve ligações) não desatualiza a síntese: a comparação das origens ignora para onde as ligações apontam, e as citações são relocalizadas no texto atual. Valida também snapshots, revisões, identidade, gerenciamento e posse do trabalho. Títulos recebem `/` e `` trocados por hífen, e um título já ocupado na pasta vira "<título> (síntese)". Só então publica nota, histórico, evidências, conceito e progresso em uma transação curta.
- Alterar uma origem deixa as sínteses dependentes desatualizadas até revalidação. Elas são processadas em ondas limitadas; dependentes ainda pendentes impedem declarar a origem concluída.
- A busca do agente inclui conhecimento por alias, citações atuais e cobertura. Ler uma nota pede seu processamento sem que uma falha da fila impeça a leitura; a busca não pede nada por resultado, porque a reconciliação já alcança toda nota sem trabalho; a própria pergunta ou a resposta do chat não vira evidência nova.

As ferramentas normais de escrita continuam exigindo pedido do usuário. A manutenção automática tem um publicador próprio, limitado às sínteses gerenciadas, sem autorização para reescrever notas pessoais.

## Ativação no ambiente escolhido

1. Revise as migrações 0007–0011, incluindo `0011_wiki_observabilidade`, e faça o backup aplicável ao ambiente. A 0011 compacta fontes antigas, cria o diário e acrescenta pausa/diagnóstico aos conceitos. Use o fluxo de migração existente (`npm.cmd run db:migrate`) somente no banco escolhido para ativação.
2. Configure no servidor:

   ```dotenv
   WIKI_VIVA_ATIVA=1
   WIKI_AUTOMATICA_ATIVA=1
   WIKI_TETO_TOKENS_DIA=200000
   WIKI_EXECUTOR_SEGREDO=<segredo-exclusivo-com-32-ou-mais-caracteres>
   CRON_SECRET=<outro-segredo-exclusivo-com-32-ou-mais-caracteres>
   BIMO_URL=http://localhost:3000
   ```

   OPENAI_API_KEY e OPENAI_MODEL são os já usados pelo chat. O executor usa HTTPS fora de localhost. Não reutilize o segredo de sessão e não exponha o segredo do executor no cliente.

3. Reinicie a aplicação ao alterar as variáveis: as capacidades do repositório ficam em cache. A sondagem espera também a tabela `eventos_wiki` e as colunas `pausada`/`diagnostico` da 0011 antes de permitir trabalho pago. Resultados negativos expiram em 30 segundos: uma instância quente reconhece migrações posteriores sem precisar reiniciar só por isso. A primeira sonda ocorre fora da transação de escrita das notas.

   Ordem do deploy: migre primeiro e suba o código depois. Durante uma migração parcial, as notas continuam funcionando e a automação fica desligada. Mover/renomear sínteses nesse intervalo pode deixá-las protegidas por revisão divergente; a retomada exige a decisão explícita de devolver ao Bimo.
4. Na Vercel, `vercel.json` prepara GET `/api/wiki/processar` às **05:00 UTC diariamente**. Configure `CRON_SECRET` no servidor: a Vercel envia o bearer automaticamente. Só esse segredo autoriza GET, inclusive quando há sessão válida no navegador; GET não aceita `acao=retomar`. O segredo não abre outras rotas. A frequência diária é compatível com Hobby e processa somente um trabalho por execução: para uma base grande, use maior frequência num plano que a suporte ou o executor contínuo. A configuração não foi publicada nem ativada por esta entrega. Referências: [autenticação do Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs) e [limites por plano](https://vercel.com/docs/cron-jobs/usage-and-pricing), consultadas em 23/10/2026.
5. Alternativamente, em outro processo, com a aplicação acessível, execute:

   ```powershell
   npm.cmd run wiki:executar
   ```

   Em hospedagem, mantenha esse processo sob o supervisor da infraestrutura escolhida. Para uma rodada controlada, use `npm.cmd run wiki:executar -- --uma-vez`.
6. O executor contínuo chama POST /api/wiki/processar com `WIKI_EXECUTOR_SEGREDO`, a cada dez segundos após terminar a rodada anterior. Não aceita userId ou conteúdo proposto pelo cliente. Cron e executor usam o dono configurado pelo servidor, conforme a arquitetura de autenticação atual do Bimo.

Há aceleração oportunista com after() após gravações e conversas. Ela não substitui o executor independente: uma função encerrada pela plataforma deixa o trabalho para retomada posterior.

Os valores do exemplo são limites conservadores para um piloto, sem evidência de ajuste ótimo. Ativação pode iniciar processamento das notas anteriores e chamadas pagas à OpenAI. Os arquivos foram preparados sem executar essa ativação.

## Persistência e concorrência

- paginas_wiki conserva snapshots compactos e afirmações por publicação, separados das versões mutáveis de autosave. Fontes guardam id/título/pasta/revisão, SHA-256 integral e normalizado para organização, e só os trechos citados, com offsets UTF-16. `conferirFontes` exige revisão, organização e hash integral exatos na publicação; leitura tolera reescritas de destinos de links. O backfill da 0011 usa SHA-256 nativo do PostgreSQL, sem extensão adicional, e os leitores continuam compatíveis com fontes no formato antigo. O histórico normal das notas continua seguindo sua retenção existente.
- conceitos_wiki identifica a síntese atual, aliases, revisões das raízes e revisão ainda gerenciada. Há unicidade de conceito por dono.
- trabalhos_wiki funciona como outbox e fila. Registra revisão, geração, cursor, tentativas, disponibilidade e posse temporária.
- consumos_wiki registra reserva, consumo confirmado/incerto, modelo e versão do pipeline. Apagar uma origem não devolve crédito já gasto.
- eventos_wiki guarda o diário por dono, com chave idempotente e índice de período/cursor. Não depende da existência da nota para preservar o relato de remoções. Clientes autenticados só podem ler seus eventos; somente o backend escreve.
- Cada query filtra o dono explicitamente, inclusive com conexão privilegiada. Constraints compostas impedem trabalhos/conceitos associados a notas de outro dono; RLS acrescenta defesa.
- As políticas RLS das quatro tabelas operacionais permitem somente leitura ao papel authenticated. Clientes não podem alterar reservas, fila, diário ou gerenciamento diretamente; escritas passam pelo backend.
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

## Edição manual e interface

Editar o conteúdo de uma síntese protege-a. Renomear/mover pelas operações próprias conserva identidade e não libera uma edição já protegida. Uma edição feita com a automação desligada também é detectada pela divergência da revisão gerenciada após reativação.

POST /api/wiki/gerenciamento exige sessão, mesma origem e JSON com notaId, revisaoBase e gerenciada. A revisão desatualizada responde 409. Definir gerenciada=false protege a síntese; definir true explicitamente permite ao compilador voltar a atualizá-la e reabre suas origens na fila. Essa decisão pode substituir o texto editado na próxima publicação; a interface comunica essa consequência antes de "Devolver ao Bimo".

A rota administrativa POST de processamento exige bearer do executor ou sessão com mesma origem. GET exige exclusivamente o bearer do Cron. Nenhum dos segredos libera notas, chat ou gerenciamento.

GET `/api/wiki/cerebro` exige sessão e devolve resumo (neurônios, sinapses, notas concluídas/elegíveis, consolidação e impedimentos), energia (tokens comprometidos/restantes e renovação à meia-noite UTC) e índice compacto dos neurônios com estado, alertas e contagens. Não envia todas as afirmações e citações do cérebro nessa listagem. GET `/api/wiki?id=…` fornece o detalhe, `estadoNeuronio`, `pausada`, alertas, perguntas recuperadas do markdown legado e as fontes acessíveis compactadas. “Notas lidas” conta trabalhos concluídos na revisão atual, não prova extração exaustiva do conhecimento.

GET `/api/wiki/diario` exige sessão e aceita `inicio`, `fim` (ISO com fuso, intervalo de até 366 dias), `limite` (1–100), `antesEm` e `antesId` juntos. Por padrão lê os últimos sete dias. Devolve `eventos` e `proximo`; use o mesmo período e o cursor seguinte. O cursor preserva microssegundos para não perder eventos no mesmo milissegundo. Todas as leituras usam `Cache-Control: no-store`.

POST `/api/wiki/gerenciamento` também aceita `{ notaId, revisaoBase, pausada }`, mutuamente exclusivo com `gerenciada`. Pausa não protege nem desprotege a edição; impede enriquecimento, inclusive se chegar entre geração e publicação. Despausar reabre as raízes de uma síntese gerenciada. Estados, por prioridade: em pausa, seu (edição protegida), sem raízes, em tensão, reconsolidando, vivo. Alertas coexistem com o estado principal.

O grafo recebe `neuronio: true` nos nós derivados e `tipo: notas | sinapse | neuronios` nas arestas. As arestas continuam vindo exclusivamente do texto, e uma fonte em metadados sem wikilink não cria ligação. A apresentação segue o HTML do usuário, preservando as instâncias de Chat e GrafoDeFundo: anel duplo nos neurônios, estados desenhados no contorno, sinapses azuis finas e ligações entre neurônios mais grossas. O filtro Só neurônios muda a apresentação e os alvos de interação, sem reconstruir a simulação. O nascimento anima sinapses e núcleo; movimento reduzido apresenta o resultado diretamente.

O protótipo manual (página `/wiki`, `POST /api/wiki`, compilação por seleção de notas e o link no cabeçalho) foi removido: nenhum caminho de inferência existe fora da fila e do orçamento persistente. `GET /api/wiki` continua como leitura (índice e, com `id`, a síntese, seu estado e as evidências das origens acessíveis). O repositório não oferece escrita direta de sínteses; só `automacao.concluir` publica.

Na página principal, **Cérebro** mostra o grafo, os filtros por nascimento/atenção, a cobertura de notas e a energia disponível. **Diário** mostra os últimos sete dias, com período fixo durante a paginação. Abrir um neurônio pelo grafo, lista ou referência do chat mostra afirmações, inferências, divergências, perguntas e sinapses; cada número leva ao trecho citado, que abre a nota de origem por id. As leituras são atualizadas a cada 30 segundos enquanto a página está visível. Isso não executa o compilador nem consome tokens do modelo.

**Editar minha nota** usa o editor e a fila de autosave existentes. O detalhe preserva o texto atual quando há edição posterior ao snapshot, mesmo em pausa, e avisa que as sinapses pertencem à última publicação do Bimo. **Pausar/Retomar consolidação** e **Devolver ao Bimo** enviam a revisão lida ao backend, desabilitam o comando durante o pedido e exibem conflito sem repetir a escrita. Trocar entre Cérebro, Diário e conversa conserva o rascunho do chat e a simulação do grafo. As telas tratam carregamento, ausência de dados, sessão expirada e configuração indisponível.

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

Os testes de persistência usam PGlite 0.5.11, um Postgres descartável em memória, e executam os arquivos SQL 0007 a 0011 sobre um substrato local anterior à wiki. Verificam rollback, revisões, posse, reservas, constraints e RLS com dois donos fictícios. Não leem .env, não usam USER_ID_PADRAO e não acessam Supabase ou modelos reais. A conexão única do PGlite não comprova contenção entre conexões físicas de um pool remoto.

Validação em 22/10/2026, após a revisão independente (ECC e Codex) e as correções dos bloqueadores: 1.974 testes passaram em 159 arquivos na suíte offline; TypeScript sem emissão, ESLint de src/scripts, sintaxe do executor e git diff --check passaram. As correções partiram de reproduções que falhavam (regressões em memória em `regressoes.test.ts`) e ganharam testes no Postgres local (`persistencia.test.ts`, `sem-migracao.test.ts`); seis delas foram conferidas quebrando a correção de propósito. As leituras e buscas do agente seguem funcionando quando a wiki falha (tabela ausente, timeout), sem o contexto da wiki. Os testes de SQL rodam em PGlite com uma conexão só, o que não comprova contenção entre conexões de um pool remoto. Integrações remotas, execução da aplicação no navegador e inferência real não foram executadas, e a migração 0009 não foi aplicada em nenhum banco.

Validação em 23/10/2026: **1.945 testes em 163 arquivos** passaram na suíte offline de `src`, excluindo a integração real do repositório e os arquivos `*.integration.test.ts`. Depois dos últimos casos de compatibilidade e do detalhe das novas APIs, **281 testes em 26 arquivos** passaram no recorte Wiki Viva, ligações, renomeação, grafo, serviço e busca por título. A inclusão da informação de pausa no contexto enviado ao modelo foi conferida novamente com **41 testes em três arquivos**. TypeScript sem emissão, ESLint e `git diff --check` passaram. A coleta inicial que alcançava testes de skills locais foi interrompida; a configuração agora limita a suíte a `src` e `scripts`, além de excluir worktrees.

Na etapa de backend, não foram executados build (carregaria `.env`), navegador, Supabase remoto, migrações reais ou chamadas pagas. A migração 0011 e o Cron diário estão preparados, sem deploy/ativação. Os testes focados cobrem diário atômico, RLS por dono, custo preservado após rollback, pausa antes da publicação, backfill Unicode, leitura de legado, cursor com microssegundos, diagnóstico sem repetição e recuperação das perguntas antigas. Nenhum commit ou push foi feito nesta etapa.

Validação das telas em 23/10/2026: **778 testes em 78 arquivos** passaram no recorte ampliado de componentes, espaço de trabalho e Wiki Viva; após os ajustes finais, **88 testes em seis arquivos** passaram novamente. TypeScript e ESLint de src/scripts passaram. A conferência visual usou uma prévia local isolada com APIs simuladas, em desktop/celular e temas claro/escuro; não comprova autenticação, dados reais nem integração hospedada. O build não foi executado para evitar leitura de `.env`; não houve migração remota, inferência paga, commit ou push.
