# Agente, rascunhos e ingestão de fontes

Verificação local: 26/10/2026. Os fluxos abaixo têm contratos e provedores distintos; não inferir integração apenas por coexistirem no repositório.

## Chat e ferramentas

O chat utiliza o transporte próprio da Responses API da OpenAI. O servidor recebe mensagens, executa chamadas de ferramentas e devolve texto e eventos do trabalho. Limites de voltas, prazo, histórico e contexto são definidos no código e podem mudar; há uma divergência documentada entre README e agente nesta ingestão, registrada em [problemas](../bugs.md).

As ferramentas buscam, listam, leem, criam e editam notas. O agente resolve caminhos contra o repositório configurado; nomes ambíguos não autorizam selecionar uma nota arbitrária. A substituição exige leitura na mesma execução e utiliza sua revisão. Escritas concluídas não são desfeitas por cancelamento da resposta.

As instruções mandam consultar as notas antes de responder sobre o acervo, tentar termos alternativos quando necessário e distinguir conhecimento geral de informação das origens. Essas são orientações ao modelo, não prova de comportamento semântico correto em qualquer resposta.

O transporte não deve expor erros internos nem registrar conteúdo das notas. A Wiki Viva acrescenta conhecimento e evidências às consultas; uma falha desse complemento não deve impedir a leitura normal das notas.

## Rascunho do editor

O rascunho usa Gemini, valida texto de entrada e retorna uma proposta para revisão. Esse fluxo é distinto da escrita das ferramentas do chat e da publicação automática de um neurônio.

## Fontes e extração

O domínio de fontes conserva material de origem e proveniência. O pipeline de ingestão tem extração de texto puro, PDF e página web e pode sugerir entidades e notas por saída estruturada do Gemini. Entidades sugeridas nascem como rascunho.

O processamento de uma fonte é explícito. Não há, por esta leitura, demonstração de uma tela de ingestão integrada ao fluxo completo da Wiki Viva. A presença dos extratores não permite afirmar suporte pronto a qualquer tipo de arquivo ou OCR de imagens.

## Onde conferir

- [Agente](../../../src/lib/agente.ts), [transporte OpenAI](../../../src/lib/openai.ts), [ferramentas](../../../src/lib/ferramentas.ts), [instruções](../../../src/lib/instrucao-do-agente.ts) e [porta de escrita](../../../src/lib/porta-de-escrita-do-agente.ts).
- [Rascunho](../../../src/lib/rascunho-do-bimo.ts) e [rota do editor](../../../src/app/api/bimo/rascunho/route.ts).
- [Fontes](../../../src/lib/fontes.ts), [ingestão](../../../src/lib/ingestao.ts), [fachada de extração](../../../src/lib/extracao/index.ts) e [proveniência](../../../src/lib/proveniencia.ts).
- [Registro histórico da Fase 3](../documentacao/Bimo%20-%20Sources%20%26%20Ingestion%20%28Fase%203%29.md) e [Wiki Viva atual](wiki-viva.md).

## 27/10/2026 — Planejamento da memória do aplicativo

O [plano completo de memória](../documentacao/Bimo%20-%20Plano%20do%20Sistema%20de%20Memoria.md) propõe conversas persistentes, preferências, decisões e pendências rastreáveis, contexto limitado, captura seletiva e esquecimento abrangendo os derivados. É uma proposta documental com fases F0–F8 e AC-001–030; não acrescenta essas funcionalidades ao código atual.

A base foi conferida no checkout `feat/wiki-viva-em-rede`, HEAD `e5d6394`: o chat conserva mensagens no estado do componente, o transporte usa Responses diretamente com `store: false` e a Wiki Viva já oferece índice e vizinhos. O plano mantém esses mecanismos de conhecimento e separa memória pessoal, histórico e resumos. A capacidade `Memory` documentada pela OpenAI pertence a Sandbox Agents; não é uma opção já ligada no transporte do Bimo.

As políticas de retenção, modo automático, informações sensíveis e uso sob dono único continuam para revisão. Nenhuma migração, teste de software ou validação remota foi executada neste planejamento.

## 29/10/2026 — Consulta de neurônios pelo chat

Conferido por leitura de código em `main`, HEAD `9a50857`: `buscar_notas` chama `consultarConhecimentoWiki` e entrega o resultado em `conhecimento`. A consulta seleciona até quatro neurônios por resultados da busca, título/aliases e resumo; exige automação disponível e ao menos uma origem acessível. Para sínteses atualizadas inclui até 4.000 caracteres; também entrega afirmações/evidências e até seis vizinhos por caminho/resumo. `indice_da_wiki` fornece o mapa; `ler_nota` devolve o conteúdo completo do neurônio com avisos e evidências.

As instruções orientam a consulta do índice para perguntas amplas, mas `responder` não obriga uma ferramenta antes de aceitar a resposta textual. O resumo visível de `buscar_notas` conta apenas os resultados normais e seus IDs, sem discriminar os neurônios acrescentados em `conhecimento`. Portanto, ausência de um passo separado "Leu" não prova ausência de contexto da Wiki, e disponibilidade das ferramentas não prova uso pelo modelo numa conversa específica.

Sem reprodução com modelo, consulta ao banco remoto ou verificação de produção nesta investigação. Nenhuma mudança no código do aplicativo.

### Exemplo do usuário: blockchain e tokenização

O print mostra busca por `blockchain tokenização tokens` sem resultados normais, seguida de leitura das notas `6 - Principais/Blockchain.md` e `6 - Principais/Token e digitalização.md`; não mostra chamada ao índice. Isso não revela o campo interno `conhecimento`, portanto não comprova ausência total de contexto dos neurônios.

Conferida a fonte publicada do LLM Wiki em 29/10: a seção de índice descreve ler primeiro o catálogo de páginas/resumos e aprofundar nas páginas relevantes; a consulta sintetiza com citações. Para o Bimo, a recomendação discutida é priorizar índice e neurônios relevantes, seguir conexões pertinentes e consultar origens para evidência, detalhes ou desatualização. Não é decisão de implementação nem exige embeddings.

Hipótese para a busca vazia: `banco.ts:267` usa `websearch_to_tsquery`, que combina palavras sem operadores por AND, segundo a documentação oficial PostgreSQL; `memoria.ts:173` também exige todas as palavras. Assim, juntar assuntos distintos e um sinônimo pode reduzir resultados a zero. Não reproduzido com os dados do usuário. Separar assuntos/reformular e consultar o índice são recomendações, sem alteração de código.

### Implementação autorizada em 29/10/2026

O pedido posterior "pode começar essa implementação" autorizou a primeira fatia: `busca-do-agente.ts` mantém a consulta original, permite até quatro consultas explícitas por assunto/sinônimo e amplia buscas simples sem resultado em até quatro termos úteis. Resultados originais vêm primeiro; os demais assuntos são intercalados e deduplicados dentro do limite global. Aspas, operadores e pontuação preservam a intenção; as consultas do repositório não foram alteradas.

`buscar_notas` agora entrega `buscas`, `ampliada`, `avisoDaBusca` quando aplicável e `indiceWiki`, mesmo com zero notas. Antes de buscar as notas, obtém até 20 entradas relevantes do índice. O índice passa a considerar aliases. Seu recibo informa a presença de neurônios e os IDs do índice entram como candidatos no grafo, sem alegar leitura completa. As instruções orientam começar pelo índice e abrir os neurônios; não foi acrescentada obrigação de ferramenta no laço de `responder`.

Validação local: 137 testes em 8 arquivos; tipos e lint dos arquivos alterados limpos. O novo módulo teve 100% de cobertura nas quatro métricas V8. Ver [evidência de TDD e limites](../verificacoes/2026-10-29-busca-do-chat.tdd.md). Sem banco real, modelo real ou produção; a automação continua textual e os sinônimos dependem de aliases/consultas. Os parágrafos anteriores registram o diagnóstico antes desta implementação.
