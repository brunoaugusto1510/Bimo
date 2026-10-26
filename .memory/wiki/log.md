# Work Log

*Append-only changelog. Agents must append a timestamped summary of their work here at the end of each session.*

## Initial Setup
- Project memory initialized via MemWiki.

## 2026-10-26T13:44:37-03:00 — Migração da documentação para a MemWiki

- Escopo confirmado: todos os documentos da pasta `docs/`.
- Migrados 25 arquivos para `.memory/wiki/documentacao/`, preservando nomes, conteúdo e subpastas.
- Ajustadas 40 referências locais após a mudança, incluindo README e CLAUDE, e corrigida a referência antiga de `extracao.ts` para a fachada `extracao/index.ts`.
- Índice com acesso direto aos 25 documentos, contexto inicial atualizado e decisão da migração registrada. As datas e os limites de verificação dos relatórios foram preservados.
- Verificação documental: contagem dos arquivos, conteúdo preservado com alterações restritas aos caminhos, resolução dos links locais e checagem de espaços do diff. Sem nova avaliação do aplicativo ou de produção nesta migração.

## 2026-10-26T14:11:30-03:00 — memwiki-ingest e memwiki-lint

- Inventariadas as árvores próprias do repositório e lidos contratos/módulos representativos de notas, autenticação, agente, ingestão, Wiki Viva, interface, grafo, mobile e testes, além de manifestos e configurações.
- Preenchidas stack, padrões, decisões e problemas; criadas cinco páginas de domínio, sem modificar o código do aplicativo.
- Atualizados índice e contexto inicial. Os 25 documentos migrados permaneceram preservados, com seus contextos e datas.
- Lint verificou links, páginas vazias, alcance a partir do índice e contexto. Exemplos em trechos de código são excluídos da checagem de wikilinks.
- Registrada divergência entre os limites do chat descritos no README e os observados no agente. A correção documental permanece proposta; não houve mudança dos limites nesta execução.
- Resultado e limites em `verificacoes/2026-10-26-ingest-lint.md`. Sem acesso a produção, leitura de valores de `.env`, modelos, testes do aplicativo, migrações, commit ou push.

## 2026-10-26T16:30:00-03:00 — Telas da Wiki Viva fiéis ao design

- Comparadas as telas implementadas (cérebro, diário, neurônio aberto e o desenho dos neurônios no grafo) com as pranchetas do artifact "Bimo — Wiki Viva: conceitos e telas", inclusive tema escuro e celular.
- Reescritas `PainelDaWiki` (agora só busca dados e delega), `CerebroDaWiki`, `DiarioDaWiki`, `NeuronioAberto`, `GlifoDoNeuronio`, `estilos.ts` e `filtro-do-cerebro.ts`; ajustada a ligação em `PaginaPrincipal`. Um subagente refez o glifo e os estados dos neurônios no canvas (`desenhar-neuronio.ts`) e acrescentou `neuroniosVisiveis` ao `GrafoDeFundo`.
- Removido o modo `comPainelWiki` do grafo; a câmera enquadra o resultado de cada filtro do cérebro.
- Verificação: suíte offline com 172 arquivos e 2.079 testes passando, `tsc --noEmit` e `eslint src` sem erros, conferência visual no navegador embutido com dados reais (claro, escuro, 375 px). Sem commit.
- Revisão independente (ECC react-reviewer) e correções: seleção escondida pelo filtro deixa de focar o grafo (teste `cerebro-na-pagina.test.tsx`), primeiro neurônio descoberto com o cérebro aberto, "Ver origens" só sem filtro, pílula da fila estática no lugar de `BimoPensando`, folhas do celular com altura máxima e rolagem, foco devolvido à citação e região `aria-live` na folha da sinapse, foco correto ao trocar Cérebro/Diário, chips Cérebro/Diário alternam, aviso para filtro sem resultado, câmera sem reenquadrar na consulta de 30 s, página anterior do diário mantida ao paginar. Suíte offline: 173 arquivos, 2.081 testes passando; `tsc` e `eslint src` limpos.
