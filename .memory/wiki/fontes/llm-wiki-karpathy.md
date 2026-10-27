# Fonte: LLM Wiki (texto do padrão)

Ingestão: 27/10/2026. Arquivo bruto: [`.memory/.raw/llm-wiki.md`](../../.raw/llm-wiki.md) (11.985 bytes, gravado em 27/10 às 08:19). O arquivo não traz URL nem autor. O conteúdo corresponde ao padrão do Karpathy que o `AGENTS.md` cita, mas não foi comparado com a versão publicada do gist. O arquivo tem só o texto da ideia; os comentários da página publicada não estão nele.

Esta página resume a fonte e a confronta com o que a MemWiki já registrava. Não reproduz o texto; para a redação original, leia o arquivo bruto. Nada no código foi alterado por esta ingestão.

## Resumo da fonte

**Ideia central.** Em vez de recuperar trechos das fontes a cada pergunta, como no RAG, o modelo compila o conhecimento uma vez numa wiki persistente de Markdown e a mantém atualizada. Ao chegar uma fonte nova, ele atualiza páginas de entidades e conceitos, revisa sínteses e marca onde a fonte contradiz afirmações antigas. A wiki acumula valor a cada fonte e a cada pergunta.

**Divisão de papéis.** A pessoa escolhe as fontes, conduz a exploração e faz as perguntas. O modelo escreve e mantém a wiki inteira: resumo, referências cruzadas, arquivamento e contabilidade. A pessoa lê; quase nunca escreve.

**Três camadas:**
- **Fontes brutas:** imutáveis; o modelo lê e nunca altera. São a fonte da verdade.
- **Wiki:** Markdown gerado pelo modelo, que é dono da camada inteira.
- **Esquema:** um arquivo como CLAUDE.md ou AGENTS.md com estrutura, convenções e fluxos. Pessoa e modelo o fazem evoluir juntos.

**Operações:**
- **Ingestão:** ler a fonte, discutir os pontos principais com a pessoa, escrever uma página de resumo, atualizar o índice e as páginas de entidades e conceitos afetadas, acrescentar ao log. Uma fonte pode tocar de 10 a 15 páginas. O autor prefere ingerir uma fonte por vez, acompanhando; ingestão em lote com menos supervisão também é possível.
- **Consulta:** procurar páginas, ler e responder com citações. A resposta pode ser página, tabela, slides (Marp) ou gráfico. Boas respostas voltam à wiki como páginas novas.
- **Lint:** procurar contradições, afirmações superadas por fontes mais novas, páginas órfãs, conceitos citados sem página própria, referências cruzadas ausentes e lacunas que uma busca na web preencheria. Também sugerir novas perguntas e novas fontes.

**Índice e log:**
- `index.md` é um catálogo por categoria, com link e resumo de uma linha por página (data e contagem de fontes opcionais). É atualizado a cada ingestão e lido primeiro na consulta. Segundo a fonte, basta até cerca de 100 fontes e algumas centenas de páginas, sem infraestrutura de embeddings.
- `log.md` é cronológico e só recebe acréscimos. A fonte sugere o prefixo `## [AAAA-MM-DD] operação | título`, que permite listar as últimas entradas com `grep`.

**Ferramentas opcionais.** Acima dessa escala, uma busca própria sobre as páginas; a fonte cita o `qmd` (BM25, vetores e reordenação por LLM, local, com CLI e servidor MCP). Um script simples também serve.

**Dicas.** Obsidian Web Clipper para trazer artigos; imagens baixadas localmente (o modelo lê o texto primeiro e as imagens depois); a visão de grafo do Obsidian para ver hubs e órfãs; frontmatter YAML para consultas com Dataview; a wiki como repositório git.

**Ressalva da própria fonte.** O texto é abstrato de propósito. Estrutura, formatos e ferramentas são opcionais e devem ser combinados com o agente para cada domínio.

## Conferência com o que a MemWiki já dizia

A [referência de 23/10](../documentacao/Bimo%20-%20LLM%20Wiki%20-%20Funcionamento%20e%20Referencias%20Obsidian.md) (§1) e o checklist C1–C16 da [auditoria de 26/10](../documentacao/Bimo%20-%20Auditoria%20da%20Estrutura%20da%20Wiki%20Viva%20vs%20LLM%20Wiki%20-%202026-10-26.md) **conferem com a fonte**. Nenhuma afirmação deles é contradita:
- três camadas, fontes imutáveis, esquema em CLAUDE.md/AGENTS.md (C1, C2, C5);
- ingestão que toca várias páginas, índice e log (C4, C6);
- respostas que voltam à wiki (C8);
- itens do lint (C9), índice com resumo de uma linha lido primeiro (C10), log só de acréscimos com prefixo (C11);
- persistência sem embeddings obrigatórios (C15).

A auditoria registrou que C16 (proteção da edição humana) vem da implementação de referência no Obsidian, não do padrão. A fonte confirma: nela a pessoa lê e o modelo escreve; não há regra de proteção do texto humano.

A auditoria leu 100 mil dos 127 mil caracteres da página publicada, que inclui comentários. O texto da ideia agora está inteiro no arquivo bruto; os comentários continuam não lidos.

## O que a fonte traz e as páginas anteriores não cobriam

| # | Ponto da fonte | Wiki Viva (app) | MemWiki |
| --- | --- | --- | --- |
| F1 | Na ingestão, discutir os pontos principais com a pessoa antes de escrever | Divergência por desenho: a fila processa sem conversa; a pessoa acompanha pelo Diário | O protocolo não tem fluxo por fonte (lacuna C6 da auditoria); esta ingestão foi feita à mão |
| F2 | Página de resumo para cada fonte | Não existe; o neurônio cita trechos da nota, mas a nota não ganha página de resumo. A [análise de granularidade](../documentacao/Bimo%20-%20Analise%20de%20Granularidade%20dos%20Neuronios.md) já dizia que um resumo de fonte pode ficar associado à origem sem virar neurônio | Esta página inaugura a pasta `fontes/` |
| F3 | O lint sugere novas perguntas e fontes, e lacunas preenchíveis pela web | Perguntas em aberto existem por neurônio; nenhuma sugestão de fonte | `/memwiki-lint` não pede isso (lacuna 11 da auditoria) |
| F4 | O índice basta até cerca de 100 fontes e centenas de páginas; depois, busca própria | `rede-v5` usa índice de até 250 entradas; acima disso, a recuperação textual já existente faz o papel de busca | O índice tem dezenas de entradas; longe do limite |
| F5 | Frontmatter YAML para consultas | Metadados ficam no banco (`paginas_wiki`), não no texto | Páginas sem frontmatter |
| F6 | O esquema coevolui entre pessoa e modelo | Política versionada (`rede-v5`) mudada por decisão do usuário | AGENTS.md e CLAUDE.md mudam por pedido do usuário |

Nenhum desses pontos é obrigatório na fonte. A tabela registra as diferenças; não recomenda implementá-las.

## Consequências para a MemWiki

- **`.raw/` deixou de estar vazia.** É a primeira fonte bruta (a auditoria apontava a pasta como nunca usada, lacuna 14). A pasta continua fora do git (`?? .memory/.raw/`), então a fonte não existe num clone novo. Versioná-la é decisão do usuário.
- **Prefixo do log.** A entrada desta ingestão em `log.md` usa o formato sugerido pela fonte (`## [2026-10-27] ingest | …`). As entradas anteriores mantêm o formato antigo.
- **Fluxo por fonte.** Esta ingestão seguiu os passos da fonte: ler, resumir em página própria, conferir as páginas existentes, atualizar índice, hot e log. Transformar isso em regra do `AGENTS.md` é mudança de esquema e depende do usuário.
