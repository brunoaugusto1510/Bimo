# Bimo — auditoria da estrutura da Wiki Viva vs LLM Wiki

Data: 26/10/2026. Base: branch `fix/revisao-geral-wiki-viva`, HEAD `e90ee94`, sincronizada com `origin/fix/revisao-geral-wiki-viva`.

## Escopo e método

Auditoria **somente de leitura**. Nada foi alterado em `src/`, testes, migrações ou configuração; `.env` não foi lido; nenhum teste foi executado; não houve acesso a produção nem ao modelo. Os únicos arquivos escritos foram este relatório, `index.md`, `hot.md` e `log.md`.

- **Régua:** [LLM Wiki — funcionamento e referências no Obsidian](./Bimo%20-%20LLM%20Wiki%20-%20Funcionamento%20e%20Referencias%20Obsidian.md) (RG). O [gist do Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) foi consultado em 26/10/2026 só para detalhar pontos que a régua resume. Confirmou: as fontes brutas são lidas e nunca alteradas pelo modelo; a ingestão atualiza o índice e acrescenta ao log, e uma fonte pode tocar várias páginas; boas respostas podem voltar à wiki como páginas; o lint procura contradições, afirmações superadas, órfãs, conceitos sem página, referências cruzadas ausentes e lacunas; o índice é catálogo com resumo de uma linha, lido primeiro na consulta; o log aceita só acréscimos e sugere o prefixo `## [AAAA-MM-DD] operação | título`; o esquema é um arquivo como CLAUDE.md ou AGENTS.md. Foram lidos os primeiros 100 mil dos 127 mil caracteres da página do gist.
- **Material de apoio:** [Revisão geral](./Bimo%20-%20Revisao%20Geral%20da%20Wiki%20Viva%20-%202026-10-26.md) (RV), [Análise de granularidade](./Bimo%20-%20Analise%20de%20Granularidade%20dos%20Neuronios.md), [Plano de RAG e Wiki Viva](./Bimo%20-%20Plano%20de%20RAG%20e%20Wiki%20Viva.md) (RAG), [Plano de Notas no Banco](./Bimo%20-%20Plano%20de%20Notas%20no%20Banco.md) (PNB), [Operação](./Bimo%20-%20Wiki%20Viva%20-%20Operacao.md) (OP), páginas de domínio, [decisões](../decisions.md) e o artefato de design "Bimo — Wiki Viva: conceitos e telas" (`project/Main.dc.html`).
- **Agentes:** `code-explorer` mapeou o checklist na camada A; `database-reviewer` revisou o esquema; `architect` julgou cada item. As afirmações centrais dos agentes foram relidas no código antes de entrar aqui.
- **Camada B:** script de lint somente de leitura, fora do repositório (links Markdown fora de blocos de código, órfãs, alcance a partir do índice), mais `git log`, `git show --stat` e `grep`.

Siglas de caminho: `A` = `src/lib/wiki/automacao.ts`; `FB` = `src/lib/wiki/fila-banco.ts`; `FM` = `src/lib/wiki/fila-memoria.ts`; `REC` = `src/lib/wiki/recuperacao.ts`; `OBS` = `src/lib/wiki/observabilidade.ts`; `NA` = `src/components/wiki/NeuronioAberto.tsx`; `BANCO` = `src/lib/repositorio-de-notas/banco.ts`.

## Veredito geral

**Camada A — a funcionalidade do app: estrutura correta no essencial.** As três camadas existem. A automação nunca altera uma nota pessoal. A ingestão é atômica, com evidência literal, posição e revisão em cada afirmação. As divergências guardam o contexto dos dois lados, a edição humana é protegida e a recuperação sem embeddings é uma decisão registrada. Nenhum item CRITICAL foi encontrado. O único HIGH: a camada de fontes não sabe quem escreveu cada nota. Uma nota criada pelo agente do chat entra como raiz independente de neurônio, sem marca de autoria, e só o prompt impede isso. O restante cumpre o padrão em parte:
- o texto integral lido foi trocado por hashes, sem decisão registrada;
- o lint, o índice e as ligações estão incompletos;
- há remoções sem evento no Diário.

**Camada B — a MemWiki: forma correta, conteúdo desatualizado.**
- **Forma:** hot, index, log, domínios e protocolo estão presentes, com 256 links locais sem nenhum quebrado e nenhuma página órfã.
- **Conteúdo:** a manutenção falhou depois da revisão geral. O `hot.md` apresenta como atual um estado que não vale mais. A revisão não chegou a hot, bugs, decisions, domínios nem ao log. A contradição sobre a migração 0011 não está registrada.
- **Protocolo:** condensar o log contradiz a regra de só acrescentar, e não há regra para sessões paralelas.
- **Fontes brutas:** a pasta `.raw/` nunca foi usada.

## 1. Checklist do padrão

| # | Item | Origem |
| --- | --- | --- |
| C1 | Três camadas separadas: fontes originais, wiki derivada, regras de manutenção | RG §1 l.13 |
| C2 | Fontes originais imutáveis: o modelo lê e não altera | RG §1 l.13 e §3.2 l.105; gist |
| C3 | Wiki derivada persistente, mantida pelo modelo, enriquecida a cada leitura ou consulta | RG §1 l.11 |
| C4 | Uma fonte pode afetar várias páginas, inclusive atualizando as existentes | Análise de granularidade l.15 |
| C5 | Esquema e regras para o agente: estrutura, convenções e fluxos | RG §1; gist |
| C6 | Ingestão: ler a fonte, escrever e atualizar páginas, atualizar índice, registrar no log | RG §1; gist |
| C7 | Consulta com referências | RG §1 |
| C8 | Boas respostas podem ser incorporadas à wiki | RG §1 l.13; gist |
| C9 | Lint: contradições, afirmações superadas, órfãs, conceitos sem página, referências cruzadas ausentes, lacunas | RG §1; itens do gist |
| C10 | Índice: catálogo com link e resumo de uma linha, por categoria, lido primeiro | RG §1; gist |
| C11 | Log cronológico só de acréscimos, com prefixo consistente | RG §1; gist |
| C12 | Links entre páginas | RG §1 |
| C13 | Rastreabilidade: cada conclusão aponta as fontes | RG §1 l.17 |
| C14 | Divergências preservadas com o contexto dos dois lados | RG §1 l.17 |
| C15 | Persistência e recuperação são decisões separadas; sem banco, plugin ou embeddings obrigatórios | RG §1 l.13 e l.21 |
| C16 | Proteção da edição humana (vem da implementação de referência, não do padrão) | RG §3.2 l.105 e §4 l.133 |

## 2. Item × camada A × camada B

Status: **conforme**; **justificada** (divergência com decisão registrada, citada na evidência); **lacuna** com severidade. Critério de severidade:
- **CRITICAL:** perda de dados pessoais ou nota pessoal alterada pelo Bimo.
- **HIGH:** informação falsa apresentada como atual, ou conhecimento fabricado que vira evidência.
- **MEDIUM:** padrão parcial que limita a qualidade ou a manutenção, ou memória que orienta mal o próximo agente.
- **LOW:** forma, nomenclatura ou conveniência.

| Item | Camada A | Camada B | Status | Evidência |
| --- | --- | --- | --- | --- |
| C1 | Notas pessoais são as fontes. Neurônios ficam na mesma tabela `notas`, marcados por `paginas_wiki` e `conceitos_wiki`. As regras estão no código | `.raw/` (fontes), `wiki/` (derivada), AGENTS.md e CLAUDE.md (regras) | A: lacuna LOW · B: lacuna LOW | **A:** veto a neurônio como fonte em `src/lib/wiki/tipos.ts:75`; fila e cobertura excluem neurônios em `FB:69,114`; não há discriminador (`src/lib/db/schema/enums.ts:11`). **B:** `.raw/` vazia e fora do git (`git ls-files .memory/.raw` vazio); `documentacao/` dentro de `wiki/` está justificada em `decisions.md:5-9` |
| C2 | A automação nunca escreve em nota pessoal. O chat escreve quando a pessoa pede | A regra "never modify" vale só para `.raw/`, que está vazia; relatórios datados não têm regra de imutabilidade | A: justificada · B: lacuna LOW | **A:** `BANCO:189-194`, `A:260-261`; chat em `src/lib/ferramentas.ts:85,108`; decisão em `decisions.md:20,22` e OP l.58. O "só a pedido" é só prompt (`src/lib/instrucao-do-agente.ts:24`). **B:** `AGENTS.md:9`; `index.md:26` convida a editar todos os documentos |
| C3 | Neurônios persistentes, gerados com JSON estrito e sem ferramentas, refeitos por revisão e por dependentes. A consulta não enriquece a wiki | Há páginas sintetizadas e nenhuma órfã, mas a revisão geral não enriqueceu nenhuma página viva | A: justificada · B: lacuna MEDIUM | **A:** `src/lib/wiki/gerador.ts:113-115`; `src/lib/wiki/consulta.ts:31-48`; decisão em RAG l.181 e OP l.56. **B:** a revisão tem só um link de entrada (`index.md:57`); `grep` não a encontra em hot, bugs, decisions nem `dominios/` |
| C4 | Até 3 propostas por trecho. Enriquecer tem precedência e o servidor descarta `criar` sobre conceito existente, mas uma paráfrase do título passa | A revisão geral deveria ter tocado hot, bugs, decisions, domínios e o PNB. Tocou só index e bugs (troca de fim de linha) | A: lacuna MEDIUM · B: lacuna MEDIUM | **A:** `A:43-47,188-193,255,268`; a paráfrase admitida em `A:297`; duplicata só pelo mesmo conjunto de palavras (`OBS:48`). **B:** `git show --stat 623f121`; `CLAUDE.md:34-36` |
| C5 | Prompt, política `sintetica-v4` versionada e gravada em cada publicação, schemas zod e limites. A pessoa não edita essas regras | Protocolo em AGENTS.md, repetido em CLAUDE.md. Condensar o log contradiz "só acrescentar". Não há regra para sessões paralelas | A: conforme · B: lacuna MEDIUM | **A:** `gerador.ts:20-112`, `src/lib/wiki/editorial.ts:4`; notas como dados separados das instruções em RAG l.244. **B:** `AGENTS.md:17,29`, `log.md:3`, `CLAUDE.md:1,38` |
| C6 | `processarWiki`: trecho, recuperação, reserva, geração, validação, publicação atômica, `conceitos_wiki` e Diário | `/memwiki-ingest` varre o repositório e preenche stack, patterns e decisions. Não há fluxo por fonte | A: conforme · B: lacuna MEDIUM | **A:** `A:482-548`, `FB:134-176`. **B:** `AGENTS.md:27`; `verificacoes/2026-10-26-ingest-lint.md:11` |
| C7 | `buscar_notas` anexa até 3 neurônios com caminho, revisão e citação | Leitura hot → index → domínios; as páginas citam código e documentos | A: lacuna MEDIUM · B: conforme | **A:** casamento por substring sem filtro de palavras comuns (`consulta.ts:33,36`); edição trivial esconde as evidências da fonte (`consulta.ts:15,26`); neurônio sem raízes ainda é devolvido (`consulta.ts:40-44`), contra `NA:23` e RAG l.189; trechos de neurônios em `notas[]` sem estado (`ferramentas.ts:219-223`). **B:** `AGENTS.md:7-8`; `dominios/wiki-viva.md:41-43` |
| C8 | Resposta do chat não vira neurônio. Mas `criar_nota` do chat cria uma nota tratada como pessoal, que pode virar raiz | O protocolo obriga registrar aprendizados; os relatórios são arquivados | A: **lacuna HIGH** · B: conforme | **A:** `src/lib/porta-de-escrita-do-agente.ts:43-45`, `BANCO:295`, `A:56,218-220`, `tipos.ts:4`; a trava é só `instrucao-do-agente.ts:24,26-27`; RAG l.181 não cobre (ver 3a). **B:** `AGENTS.md:12-13` |
| C9 | Diagnóstico local com 5 alertas. Faltam contradição entre neurônios, afirmação superada como alerta, órfão, conceito sem página e referência ausente. Alerta resolvido não gera evento | `/memwiki-lint` só procura desatualizados, hot e páginas vazias; a contradição da 0011 escapou | A: lacuna MEDIUM · B: lacuna MEDIUM | **A:** `OBS:40-76`, `FB:261-262`. **B:** `AGENTS.md:28`; seção 3c |
| C10 | Índice compacto recalculado a cada chamada (até 120 entradas e 12 mil caracteres), sem resumo. A chave não muda quando o neurônio é renomeado | `index.md` por categoria, com resumo de uma linha. Diz "25 documentos" (são 26) e põe a revisão geral em "migrada" | A: lacuna MEDIUM · B: lacuna LOW | **A:** `REC:22,25,138-152`, `A:247,249-254,418`; não ser página é decisão (RAG l.114). **B:** `index.md:24-26,57` |
| C11 | O Diário só recebe acréscimos, mas por convenção do código, não por restrição do banco. Perguntas, pares e afirmações removidos não geram evento. Sem retenção | `log.md` só recebe acréscimos desde `30366d4`. Falta a sessão da revisão geral; sem prefixo de operação; "Initial Setup" sem data; carimbo da l.25 não observável | A: lacuna MEDIUM · B: lacuna MEDIUM | **A:** `FB:19-21`; `A:262,273-274,339-353,366,379`; `src/lib/wiki/diario.ts:15-17`. **B:** `log.md:5,25`; `git show --stat 623f121`; arquivo gravado às 16:21 e commitado às 16:45:39, entrada carimbada 16:30 |
| C12 | Ligações validadas e escritas como `[[...]]`; a tabela `relacoes` não é usada. Neurônios da mesma rodada não nascem ligados; 10 de 14 estavam sem ligação em 25/10 | 256 links locais, 0 quebrados; a revisão geral só tem um link de entrada | A: lacuna MEDIUM · B: lacuna LOW | **A:** `A:173-185,368-369,406`; links no corpo proibidos (`gerador.ts:109`); Análise de granularidade l.25-31. **B:** script de lint |
| C13 | Cada afirmação tem citação literal com posição e revisão. A autoria da fonte não é rastreada. A 0011 descartou o texto integral lido, sem decisão registrada | As páginas citam fontes, mas o hot aponta base e commit errados | A: **lacuna HIGH** · B: lacuna LOW | **A:** `A:224-241,287`; `tipos.ts:4,9-15`; `drizzle/0011_wiki_observabilidade.sql:24-35`; `versoes_nota` sem revisão (`src/lib/db/schema/versoes.ts:55-83`); a falta de checagem lexical é risco aceito (RV l.43); RAG l.46, l.98, l.222. **B:** `hot.md:9` |
| C14 | Pares guardam o contexto dos dois lados. Só a nota que sustenta uma afirmação pode trocá-la ou retirá-la. Os pares valem só dentro de um neurônio e podem cair sem evento | A divergência README × agente está registrada com os dois lados; a contradição da 0011, não | A: lacuna MEDIUM · B: lacuna MEDIUM | **A:** `tipos.ts:20`, `A:309-313,361-393`, `diario.ts:26`; decisão em RV l.42. **B:** `bugs.md:9-13`; PNB l.348 e l.438 × RV l.46-53 |
| C15 | Sem embeddings nem Personalized PageRank; recuperação textual pela interface do repositório | Markdown e protocolo, sem plugin nem banco | A: conforme · B: conforme | **A:** busca por `embedding\|vetor\|pagerank` sem resultado além da coluna `tsvector`; decisão em RAG l.52-54 e `decisions.md:24` |
| C16 | Editar o conteúdo protege o neurônio; a publicação recusa neurônio protegido; "Devolver ao Bimo" exige `revisaoBase`. Sobra `src/lib/notas.ts:116-161`, sem CAS | Não há marca de revisão humana; só "append or refine" e o git | A: lacuna LOW · B: lacuna LOW | **A:** `BANCO:104-107,191-194`, `FB:201,205`, `NA:68-72`; `notas.ts` só é importado por `ingestao.ts` e `versoes.ts`, que o app não usa (relatado pelo `database-reviewer`). **B:** `AGENTS.md:17` |

## 3. Pontos de atrito

### 3a. Nota criada pelo chat que vira fonte de neurônio — HIGH, sem decisão que cubra

- `criar_nota` grava com `criadoPor: "agente"` (`porta-de-escrita-do-agente.ts:43-45`), e a nota entra na fila (`BANCO:295`).
- Toda nota sem metadados de neurônio vale como raiz (`A:218-220`), e o modelo a recebe como nota pessoal (`A:56`).
- `FonteWiki` não carrega o autor (`tipos.ts:4`). `notas.criado_por` existe (`src/lib/db/schema/notas.ts:34`), mas não chega à fonte nem é atualizado por edições.
- `editar_nota` no modo "acrescentar" mistura texto do agente numa nota da pessoa sem marcar a autoria.

Isso contorna o veto "uma página derivada não pode ser fonte" (`tipos.ts:75`): o chat lê um neurônio, grava um resumo com `criar_nota`, e esse resumo sustenta outro neurônio. A barreira é só de prompt: "Não use criar_nota para fabricar aprendizado a cada resposta" (`instrucao-do-agente.ts:26-27`).

O RAG l.181 decide que "Respostas do chat não viram fatos automaticamente", mas pressupõe conhecimento fornecido pela pessoa. Ficam sem cumprimento três pontos do mesmo plano:
- guardar a autoria (l.46);
- tratar como anotação pessoal só o conteúdo do usuário ou importado (l.76);
- não contar sínteses de mesma raiz como fontes independentes (l.84, l.284).

### 3b. A 0011 trocou o texto das fontes por hashes e trechos — sem decisão registrada

- O RAG pedia snapshots com texto exato e imutável (l.98, l.222, l.293) e já avisava que o histórico do editor não é snapshot (l.64).
- A 0011 guarda só hashes e os trechos citados, sem backup nem reversão (`drizzle/0011_wiki_observabilidade.sql:24-35`).
- `versoes_nota` não tem revisão, e numa sessão aberta o editor atualiza a última versão em vez de criar outra (`BANCO:83-91`). Por isso o texto lido numa revisão não pode ser reconstruído.
- PNB l.330 e OP l.95 descrevem a mudança como implementação. O único motivo escrito é o comentário de `src/lib/wiki/fontes.ts:14`.
- O comentário de `src/lib/db/schema/wiki.ts:7` ("o histórico da nota preserva o texto anterior") é impreciso.

Classificada como MEDIUM, e não HIGH, porque a consulta esconde a evidência que não confere em vez de apresentá-la como atual.

### 3c. Contradição sobre a migração 0011 — MEDIUM; estado de produção não verificado

PNB l.348 e l.438 e OP l.7 registram a 0011 aplicada no Supabase em 23/10. RV l.46-53 descreve uma "ordem segura" de deploy como se ela estivesse pendente e não diz a que ambiente se aplica. A 0011 não mudou depois de 23/10: o último commit no arquivo é `862b459`, e `87b6da8` não tocou `drizzle/`.

Há dois riscos para o próximo agente. Um é executar a ordem em produção sem necessidade, desligando as variáveis e migrando. O outro é ler "tudo aplicado" e esquecer que a nota ainda vale para um ambiente novo e para o rollback de código (RV l.51).

### 3d. `hot.md` desatualizado e revisão geral sem hot e log — MEDIUM

O `hot.md`, lido primeiro (`AGENTS.md:7`), dizia três coisas que não valiam mais:
- a base é "`main`, commit `99e0cc8`" (l.9);
- "nada commitado" (l.16);
- o próximo passo é commitar as telas (l.20).

Na verdade, as telas estão em `d1677a9` e `57754ae`, e a branch está no origin. O `hot.md` também não citava a revisão geral, os achados abertos nem a nota da 0011. O commit `623f121` não atualizou `hot.md` nem `log.md`, contrariando `AGENTS.md` §3. Esta auditoria acrescentou ao `hot.md` o estado observado, sem apagar as linhas antigas.

### 3e. `/memwiki-fold` — LOW

"Condensar entradas antigas num parágrafo" (`AGENTS.md:29`) reescreve o log, o que contradiz "append-only" (`log.md:3`) e "Never delete knowledge" (`AGENTS.md:17`). Nunca foi executado.

### 3f. `documentacao/` dentro de `wiki/` e `.raw/` vazia — LOW, com parte justificada

A localização de `documentacao/` está decidida (`decisions.md:5-9`). Falta separar a evidência datada, que não deve mudar, das páginas vivas, que continuam recebendo atualizações (OP, Pendências, PNB). Essa falta alimenta 3c e 3d.

A pasta `.raw/` está vazia e, como diretório vazio, não existe num clone novo. O fluxo `.raw → wiki` nunca foi exercido (`verificacoes/2026-10-26-ingest-lint.md:11`).

## 4. Lacunas priorizadas e recomendações (não implementadas)

| # | Sev. | Camada · itens | Lacuna | Recomendação |
| --- | --- | --- | --- | --- |
| 1 | HIGH | A · C8, C13, C1 | Nota do chat entra como raiz anônima (3a) | Levar o autor da nota (ou da versão) à `FonteWiki` e ao que o modelo recebe; não aceitar texto do agente como raiz independente sem confirmação ou edição da pessoa |
| 2 | MEDIUM | B · C3, C5, C11 | `hot.md` desatualizado; `623f121` sem hot e log (3d) | Manter o hot pelo estado do git ao fim de cada tarefa; criar regra de escrita do hot e do log para sessões paralelas |
| 3 | MEDIUM | B · C9, C14 | Contradição sobre a 0011 (3c) | Registrar em `bugs.md` a que ambiente vale a nota de deploy e conferir o histórico do Drizzle em produção |
| 4 | MEDIUM | A · C13, C2 | Texto integral descartado sem decisão; `versoes_nota` sem revisão; comentário impreciso (3b) | Registrar em `decisions.md` se o padrão aceita hash e trecho no lugar do texto lido; corrigir o comentário de `src/lib/db/schema/wiki.ts:7` |
| 5 | MEDIUM | B · C4, C6 | Revisão geral não propagada a bugs (RV l.55-70), decisions (RV l.39-44), `dominios/wiki-viva.md` e PNB | Fazer uma ingestão daquela fonte: decisões em `decisions.md`, achados em `bugs.md`, resumo no domínio |
| 6 | MEDIUM | A · C7 | Consulta: substring sem palavras comuns; neurônio sem raízes devolvido; trechos sem estado | Usar `PALAVRAS_COMUNS` de `REC:28-35` em `consulta.ts`; excluir `sem_raizes`; marcar o estado dos neurônios em `notas[]` |
| 7 | MEDIUM | A · C11, C14 | Perguntas, pares de divergência e afirmações somem sem evento | Emitir evento no Diário para cada remoção estrutural |
| 8 | MEDIUM | A · C9 | Lint sem contradição entre neurônios, órfãos ou afirmações superadas; alerta resolvido sem evento | Acrescentar esses alertas locais e um evento de resolução |
| 9 | MEDIUM | A · C10, C4 | Índice sem resumo; teto de 120 impede enriquecer o que fica fora; chave congelada; paráfrases | Resumo curto por entrada; atualizar a chave ao renomear; verificação de paráfrase |
| 10 | MEDIUM | A · C12 | Ligações esparsas; neurônios da mesma rodada não se ligam | Etapa de relacionamento depois de publicar o lote; medir de novo a proporção sem ligação |
| 11 | MEDIUM | B · C9 | `/memwiki-lint` estreito | Incluir em `AGENTS.md:28` contradições, afirmações superadas e referências cruzadas |
| 12 | MEDIUM | B · C11 | Log sem a sessão da revisão geral e sem a remoção de `76835a3` (MemWiki anterior, 19/10) | Acrescentar entradas retroativas marcadas como tal |
| 13 | LOW | B · C5, C11 | `/memwiki-fold` × só acréscimos (3e) | Arquivar as entradas antigas intactas e anexar o resumo como entrada nova |
| 14 | LOW | B · C1, C2 | `documentacao/` sem marcar evidência datada; `.raw/` vazia e não versionada (3f) | Marcar no índice os documentos datados; versionar `.raw/` com um marcador ou retirar a regra |
| 15 | LOW | B · C10 | Índice diz "25 documentos" e põe a revisão geral em "migrada" | Corrigir a contagem e criar uma seção para documentos posteriores à migração |
| 16 | LOW | B · C5 | Protocolo carregado duas vezes (`CLAUDE.md:1` e `@AGENTS.md` em `CLAUDE.md:38`) | Manter uma só cópia |
| 17 | LOW | A · C16 | `src/lib/notas.ts:116-161` escreve sem CAS nem proteção (sem chamador ativo) | Remover ou exigir revisão-base |
| 18 | LOW | A · C1 | Neurônio sem discriminador no banco; RLS `FOR ALL` em `paginas_wiki` | Ver o risco 3 da seção 5 |
| 19 | LOW | A · C11, C12, C13 | Diário em formato tipado sem tipo de operação; comentário de `A:405` impreciso (`estrutura.ligacoes` é cópia persistida); `trechos` gravado sem leitor | Documentar a escolha ou limpar |
| 20 | LOW | B · vocabulário | O termo que a regra de vocabulário proíbe aparece em prosa num documento histórico (Knowledge Core l.66); os demais usos são nomes legados de arquivo e de variável, ou a própria regra (PNB l.18) | Anotar o documento histórico, sem reescrevê-lo |

## 5. Riscos do esquema fora do checklist

Levantados pelo `database-reviewer` e mantidos na severidade dele. Não entram no veredito estrutural, mas afetam a operação.

| # | Sev. | Risco | Evidência |
| --- | --- | --- | --- |
| 1 | MEDIUM | 0011 irreversível, sem backup nem migração de volta | `drizzle/0011_wiki_observabilidade.sql:24-35` |
| 2 | MEDIUM | Fonte não imutável por revisão | `src/lib/db/schema/versoes.ts:55-83`; `BANCO:83-91` |
| 3 | MEDIUM | `paginas_wiki` com RLS `FOR ALL` e sem chave estrangeira composta por dono. A exposição da API de dados do Supabase não foi verificada; RV l.64 já registrava o achado | `src/lib/db/schema/wiki.ts:9,16-18` |
| 4 | MEDIUM | Crescimento sem retenção de `paginas_wiki`, `eventos_wiki` e `consumos_wiki`; a listagem lê o histórico inteiro para pegar a última revisão | `BANCO:208,224-225`; `FB:125` |
| 5 | MEDIUM | Consultas uma a uma (N+1) ao montar o estado e o índice da wiki | `src/lib/wiki/servico.ts:16-19,27-30`; `consulta.ts:13-16` |
| 6 | MEDIUM | Posse de 120 s sem renovação, com a chamada paga dentro dela (já registrado em RV l.61) | `FB:94`; `A:508,535`; `src/lib/wiki/lote.ts:11` |
| 7 | MEDIUM | `origens`, `fontes[].revisao` e `revisao_gerenciada` mantidos só pelo código | `FB:101,159-161` |
| 8 | LOW | Referências sem chave estrangeira (proposital em eventos e consumos); `paginas_wiki` sem carimbo de data, modelo ou versão do pipeline; conexão sem `max` nem prazos | `src/lib/db/schema/wiki-automatica.ts:26,59`; `src/lib/db/cliente.ts:19` |

O isolamento por `user_id` foi verificado em todas as consultas lidas de `fila-banco.ts`, `eventos-banco.ts` e nas partes da wiki em `banco.ts`.

## 6. Achados da revisão geral reconferidos

- **Ainda presentes no código:**
  - casamento por substring sem filtro de palavras comuns (`consulta.ts:33,36`);
  - divergência entre a fila em memória e a do banco: `reconciliar` em memória não emite `despertar` (`FM:64-71` × `FB:73-76`), e também diferem a ordem de reivindicação, `PosseExpirada`, o controle de concorrência do diagnóstico, a cobertura e o truncamento do erro;
  - perguntas em aberto e pares de divergência que somem sem evento.
- **Não verificado:** se existe uma suíte de contrato da fila nos dois adaptadores.
- **Superados:**
  - RV l.3 diz que a branch "ainda não [foi] enviada ao GitHub", mas ela existe no origin;
  - RV l.79 diz que o CLAUDE.md "ainda manda o andamento para `docs/`", mas `CLAUDE.md:36` aponta para `.memory/wiki/documentacao/`.
- **Ainda aberto na camada B:** a divergência de limites do chat entre `README.md:49` (45 s) e `src/lib/agente.ts:10-11` (12 voltas, 150 s) continua como registrada em `bugs.md`.

## 7. Limites desta auditoria

- **Produção:** não verificada. Não foi possível confirmar se a 0011 está aplicada, nem a exposição da API de dados, nem o volume de linhas. Os números de neurônios (14, com 10 sem ligação) vêm da análise de 25/10.
- **Testes e banco:** nenhum teste foi executado e não se rodou `EXPLAIN`. Os testes citados como evidência rodam em PGlite.
- **Leituras parciais:** do artefato de design, só a prancha de vocabulário; do gist, os primeiros 100 mil caracteres.
- **Código não relido por mim:** o comportamento de `src/lib/notas.ts` e alguns detalhes de índices vêm do `database-reviewer`. As linhas centrais de cada lacuna HIGH e MEDIUM foram relidas.
- **Resto desta sessão:** um `bash.exe.stackdump` criado às 17:12 em `.memory/`, ignorado pelo git (`.gitignore:42`). A remoção não foi autorizada nesta sessão e o arquivo continua lá.
