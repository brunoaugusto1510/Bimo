# Wiki Viva do aplicativo

Verificação local: 26/10/2026. O checkout contém alterações em andamento. Os contratos abaixo foram observados no código; relatos de ativação e ensaios remotos permanecem nos documentos datados.

## Papel e fronteiras

A Wiki Viva compila conhecimento persistente a partir das notas salvas. Uma síntese, apresentada como neurônio, é uma nota com metadados de afirmações, evidências e estrutura. Novas sínteses nascem em `Neurônios`; o papel é definido por metadados, não pelo nome da pasta.

As raízes são notas pessoais. Cada afirmação tem identidade e natureza explícita ou inferencial, com trechos das origens. Ligações entre neurônios representam relação, sem transformar outra síntese em evidência independente. Lacunas e divergências são dados estruturados e também aparecem na apresentação.

MemWiki é a memória de desenvolvimento em `.memory/wiki/`; ela não é esta funcionalidade nem a fila de processamento das notas da pessoa.

## Processamento

As escritas elegíveis registram trabalho junto da transação. A fila consolida autosaves, utiliza estabilidade de 90 segundos e reconcilia notas anteriores. Cada rodada seleciona um trecho, candidatas e um índice compacto dos conceitos existentes.

A política observada é `sintetica-v4`. O envelope distingue propostas e decisões sem publicação. Criar, enriquecer e relacionar precisam atender critérios editoriais; conservar a origem e adiar têm campos próprios. Adiamento por falta de leitura de um neurônio identifica os destinos solicitados. A implementação limita essas leituras e o contexto fornecido ao modelo.

O servidor valida estrutura, evidências, destinos, operações sobre afirmações e divergências. A chamada ao modelo ocorre fora da transação. A publicação revalida revisões, posse e geração e grava nota, histórico, metadados e progresso de forma atômica.

Edição manual protege o neurônio. Pausa, retomada e devolução ao gerenciamento são ações distintas, com revisão-base e tratamento de conflito.

## Lotes e orçamento

A rota chama o processador de lotes, com até 25 rodadas por requisição. O lote para de abrir rodadas ao atingir sua margem de tempo e tem sinal de cancelamento próprio; a rota declara duração máxima de 300 segundos. No código observado, um impedimento editorial da nota permite tentar o próximo trabalho, enquanto falhas de provedor/configuração interrompem o avanço do lote.

O orçamento é reservado antes da inferência e acompanhado por dono e dia UTC. Consumo incerto continua comprometido. Os limites são de tokens e não equivalem a um preço fixo em dinheiro. A reserva não garante publicação nem elimina toda possibilidade de custo repetido após falha externa.

O GET de processamento exige o segredo do Cron. O POST admite executor autorizado ou sessão com mesma origem. O executor contínuo é uma alternativa ao agendamento e às acelerações após atividade.

## Recuperação e observabilidade

A construção usa termos característicos, títulos, aliases e dependências. São recortes limitados; o índice pode estar parcial. O chat acrescenta às buscas sínteses e evidências ainda válidas, com aviso de cobertura. O mecanismo consultado não usa embeddings nem Personalized PageRank.

Diagnóstico local identifica condições como raízes ausentes, possíveis duplicatas e ligações quebradas. O diário registra eventos de publicação e impedimentos. Cérebro e detalhe de neurônio apresentam cobertura, energia, estados e evidências. O lint de sínteses do aplicativo é diferente do lint da MemWiki solicitado aos agentes.

## Rede de neurônios — política `rede-v5` (26/10/2026, noite)

Decisão em [decisões](../decisions.md). O que mudou no código:

- **Escrita:**
  - até 6 propostas por resposta (`PROPOSTAS_POR_RESPOSTA` em `editorial.ts`);
  - `resumo` de uma linha por neurônio em `estrutura.resumo` (null mantém o atual);
  - `ligacoes` aceita `proposta:N` para outra proposta da mesma resposta. `ligarIrmas` (`automacao.ts`) liga as duas nos dois sentidos, só entre as publicadas, e escreve o link no texto; a fila completa os ids em `estrutura.ligacoes` depois de gravar (`ligacoesComIrmas`, mesma transação);
  - teto de 16 ligações (`LIMITE_DE_LIGACOES` em `tipos.ts`).
- **Índice e recuperação:**
  - `conceitos()` traz `resumo` (ou a primeira afirmação) e `ligacoes` da publicação mais recente;
  - o índice que o modelo vê tem até 250 entradas e 30 mil caracteres, com resumo, e o resumo conta na pontuação;
  - 8 candidatas por rodada; vizinhos de um neurônio pontuado herdam metade da pontuação (`vizinhosDosNeuronios`);
  - candidatas trazem `ligadoPor`.
- **Chat:**
  - `consultarConhecimentoWiki` casa termos inteiros (`comTermosDe`, aceita siglas) e exclui neurônio sem nenhuma origem;
  - devolve até 4 neurônios e `relacionados` (vizinhos com caminho e resumo);
  - a ferramenta `indice_da_wiki` mostra o mapa: resumo, `ligaA` e `citadoPor`.
- **Lint:**
  - o alerta `isolado` é informativo (`pedeAtencao`): não vai ao Diário nem a "Precisam de você";
  - se o neurônio continua isolado na verificação seguinte e a fila está ociosa, a origem é relida uma vez (`diagnostico.religacao`), no máximo duas origens por verificação.
- **O que não mudou:** citação literal obrigatória, nenhuma escrita em nota pessoal, proteção por edição manual, a regra "só a nota que sustenta troca ou retira", o teto de contexto (65 mil bytes) e o orçamento diário.
- **Ajustes das revisões independentes (`code-reviewer` do ECC e Codex):**
  - a descoberta usa `max_output_tokens` de 12.288 (`SAIDA_MAXIMA_DA_WIKI`, o mesmo valor da reserva), enquanto o chat segue com 4.096;
  - a marca `religacao` sobrevive à republicação do neurônio e vale também para irmãos da mesma origem;
  - o par `proposta:N` só fecha com vaga nas duas pontas;
  - uma síntese existente que só seria republicada por `proposta:N`, sem link novo, não é republicada;
  - a consulta aceita termos de 3 letras como palavra inteira, ordena título e apelido antes de resumo, e exclui neurônios sem raízes também dos relacionados e do índice;
  - a assinatura do diagnóstico ignora `isolado`;
  - `limitarContexto` corta o índice até 60 entradas antes de cortar candidatas.
- **Testes:** `rede.test.ts` (memória). A jornada (`jornada.test.ts`) passou a verificar que nada existente é apagado ou trocado, em vez de exigir que nenhum neurônio mude: com mais candidatas, um neurônio devolvido ao Bimo pode ser enriquecido por uma nota nova.

## Evidência e limites

Localizar uma citação e conferir sua revisão não demonstra que ela sustenta logicamente a conclusão. Cobertura mede processamento, sem garantir leitura exaustiva ou qualidade. O histórico de ensaios deve ser usado com a data, política e amostra descritas.

Fontes de navegação: [tipos](../../../src/lib/wiki/tipos.ts), [política editorial](../../../src/lib/wiki/editorial.ts), [automação](../../../src/lib/wiki/automacao.ts), [lote](../../../src/lib/wiki/lote.ts), [fila do banco](../../../src/lib/wiki/fila-banco.ts), [recuperação](../../../src/lib/wiki/recuperacao.ts), [consulta](../../../src/lib/wiki/consulta.ts), [observabilidade](../../../src/lib/wiki/observabilidade.ts), [configuração](../../../src/lib/wiki/configuracao.ts) e [rota](../../../src/app/api/wiki/processar/route.ts).

Histórico e operação: [entrega consolidada](../documentacao/Bimo%20-%20Entrega%20Consolidada%20da%20Wiki%20Viva%20-%202026-10-26.md), [operação](../documentacao/Bimo%20-%20Wiki%20Viva%20-%20Operacao.md), [pendências](../documentacao/Bimo%20-%20Wiki%20Viva%20-%20Pendencias.md) e [referência histórica de Obsidian](../documentacao/Bimo%20-%20LLM%20Wiki%20-%20Funcionamento%20e%20Referencias%20Obsidian.md).

Padrão de referência: o texto do LLM Wiki está em `.memory/.raw/` desde 27/10, resumido em [fonte: LLM Wiki](../fontes/llm-wiki-karpathy.md). A página lista onde a Wiki Viva diverge por desenho: ingestão sem conversa com a pessoa, nenhuma página de resumo por nota e metadados no banco em vez de frontmatter.
