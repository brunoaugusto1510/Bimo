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

## 2026-10-26T17:37:18-03:00 — Auditoria da estrutura da Wiki Viva vs LLM Wiki (lint)

- **Escopo:** auditoria somente de leitura, na branch `fix/revisao-geral-wiki-viva`, HEAD `e90ee94`.
- **Checklist:** C1–C16, extraído da referência LLM Wiki. O gist do Karpathy foi conferido para fontes imutáveis, retorno de respostas, itens do lint, índice e prefixo do log.
- **Camada A** (funcionalidade do app):
  - `code-explorer` mapeou a feature e `database-reviewer` revisou o esquema.
  - As linhas centrais foram relidas no código.
- **Camada B** (MemWiki):
  - Lint por script: 39 páginas, 256 links locais, 0 quebrados, 0 órfãs, todas com link direto no índice.
  - `git log` e `git show` apontaram hot desatualizado e o commit `623f121` sem hot e log.
- **Julgamento** (`architect`): nenhum CRITICAL; um HIGH na camada A, nota do chat como raiz sem autoria; contradição sobre a 0011 entre o Plano de Notas no Banco e a revisão geral.
- **Gravado:**
  - Relatório em `documentacao/Bimo - Auditoria da Estrutura da Wiki Viva vs LLM Wiki - 2026-10-26.md`.
  - Link no índice.
  - Hot com o estado atual acrescentado e as linhas antigas anotadas, sem apagar conteúdo.
- **Não houve:**
  - alteração em `src/`, testes, migrações ou configuração;
  - leitura de `.env`, execução de testes, acesso a produção ou implementação das recomendações.
- **Pendente:** um `bash.exe.stackdump` criado por esta sessão em `.memory/`, ignorado pelo git. A remoção não foi autorizada.

## 2026-10-26T20:25:00-03:00 — Wiki Viva em rede (política `rede-v5`)

- **Decisão do usuário:** aceitar o HIGH da auditoria (nota do chat como raiz) e implementar as recomendações sem conservadorismo, perto do LLM Wiki. Registrada em `decisions.md`.
- **TDD:** `src/lib/wiki/rede.test.ts` escrito antes do código (11 falhas pelo motivo certo). Hoje tem 19 testes.
- **Código**, na branch `feat/wiki-viva-em-rede`:
  - política e prompt;
  - esquema da proposta com `resumo` e `proposta:N`;
  - ligação recíproca entre irmãs;
  - `conceitos()` com resumo e ligações;
  - índice com resumo e vizinhos na recuperação;
  - consulta com `relacionados` e a ferramenta `indice_da_wiki`;
  - lint `isolado` com releitura limitada;
  - teto de saída da descoberta.
  - Sem migração.
- **Testes antigos ajustados:**
  - versão `rede-v5`;
  - tetos de 16 ligações, 250 entradas e 8 candidatas;
  - seis ferramentas;
  - consulta que exclui neurônio sem raízes;
  - jornada passo 8, que agora verifica "nada apagado ou trocado".
- **Revisões independentes** (`code-reviewer` do ECC e Codex), com achados aplicados:
  - teto de 4.096 tokens de saída insuficiente;
  - marca de releitura perdida na republicação;
  - reciprocidade com vaga nas duas pontas;
  - raízes conferidas no índice e nos relacionados;
  - termos de 3 letras;
  - republicação sem efeito;
  - corte do contexto.
- **Verificação:** `tsc` e `eslint src scripts` limpos; 2.100 testes offline (174 arquivos), excluindo `repositorio-de-notas/banco.test.ts` e `tests/busca-textual.integration.test.ts`.
  - Uma execução anterior incluiu `src/lib/tests` inteiro e pode ter rodado a suíte de integração contra o Supabase (ela usa usuários efêmeros).
  - Sem modelo real, produção, commit ou push.

## 2026-10-27 — Commit da Wiki Viva em rede

- A pedido do usuário, a branch `feat/wiki-viva-em-rede` foi commitada com código, testes e MemWiki da política `rede-v5`.
- O ponteiro `.claude/worktrees/login-multiusuario` ficou fora do commit.
- Sem push, PR, modelo real ou produção.
