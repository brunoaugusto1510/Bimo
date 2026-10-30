# Revisão dos neurônios de blockchain e economia vs LLM Wiki

Data: 30/10/2026, 08h52 de Brasília. Pedido: ler os neurônios criados e avaliar sua conformidade com a estrutura LLM Wiki.

**Continuação autorizada:** as correções e a manutenção real posteriores estão em [Consolidação de blockchain/economia](2026-10-30-consolidacao-blockchain-economia.md). Este relatório preserva a fotografia anterior às alterações.

## Escopo e método

- Leitura real pelo conector Supabase do projeto Bimo, somente SELECT; nenhum dado remoto alterado e nenhuma inferência paga.
- Sete neurônios atuais, ids 4869–4875, criados em 29/10; comparados seus textos completos, afirmações, fontes, estrutura e diagnóstico com oito notas de origem completas. Duas notas adicionais, 2645 e 2647, foram abertas para entender a origem editorial: contêm somente referência a um PPTX. O arquivo PPTX não foi lido.
- Cada neurônio foi contado uma vez, usando `paginas_wiki.revisao_publicada = notas.revisao`. Criptoeconomia tem duas publicações históricas, mas é um único neurônio.
- Referência: texto integral local [LLM Wiki](../../.raw/llm-wiki.md), com [resumo da fonte](../fontes/llm-wiki-karpathy.md). Não houve nova consulta ao gist publicado.
- Código local observado: `main`, HEAD `9a50857`, com alterações preexistentes. Código local não comprova a versão implantada.

## Conclusão

Conformidade parcial: há páginas persistentes por conceito, fontes rastreáveis, resumo de uma linha, relações e um caso de enriquecimento. Entretanto, o conjunto contém uma duplicata efetiva, apresenta pouco desenvolvimento das relações no corpo das sínteses e não explicita lacunas de contexto/data. Ter várias páginas a partir das mesmas notas não é, por si, um desvio do LLM Wiki. Uma página também pode começar com uma só fonte.

## Inventário atual

| ID | Neurônio | Origens | Afirmações | Avaliação editorial |
| --- | --- | ---: | ---: | --- |
| 4869 | Criptoeconomia (síntese) | 3 | 5 | Assunto panorâmico válido; reúne fontes e passou da revisão 1 para a 2. Ainda enumera afirmações, com pouca explicação das relações. |
| 4870 | Bitcoin (síntese) | 2 | 4 | Página de entidade válida; reúne descrição do ativo e funções econômicas. Dado quantitativo sem data explícita na síntese. |
| 4871 | Blockchain (síntese) | 2 | 3 | Conceito distinto de Bitcoin, com evidências nas duas origens. Desenvolvimento curto. |
| 4872 | Mercados centralizados e descentralizados (síntese) | 1 | 2 | Comparação com assunto próprio, mas praticamente paráfrase da origem. Deve ser o ponto de consolidação do tema, em vez de coexistir com a duplicata. |
| 4873 | Mercados centralizados e descentralizados (síntese) (síntese) | 1 | 2 | Duplicata sem ganho temático: mesma origem 2864 e mesmas duas proposições de 4872. |
| 4874 | Tokenização e ativos digitais | 1 | 2 | Conceito próprio defensável; reproduz mecanismo e exemplos da origem, sem integrar a explicação com blockchain/Web 3. |
| 4875 | Web 3 (síntese) | 1 | 5 | Tema próprio defensável; organiza a comparação Web 1/2/3, mas é majoritariamente uma reformulação da origem. |

Total: **7 neurônios, 23 afirmações, 25 evidências e 8 notas de origem distintas**. Se a duplicata fosse consolidada, seriam seis temas; isso é recomendação, não alteração executada.

## Achados priorizados

### P2 — duplicação em vez de acumulação no mesmo tema

Os ids 4872 e 4873 descrevem os mesmos modelos de mercado e a relação com Web 3. Ambos usam exclusivamente a nota 2864. As diferenças são de redação e links, não de assunto. A duplicata ainda aparece no panorama 4869 e em Web 3 (4875), dividindo a navegação.

A justificativa editorial registrada em 4873 reconhece a existência da síntese no índice, mas argumenta que ela não havia sido fornecida como candidata gerenciada lida. Isso não justifica criar o mesmo tema novamente: o fluxo deveria solicitar leitura e então enriquecer, relacionar ou conservar.

O diagnóstico persistido, verificado em 29/10 às 12h13 UTC, está sem alertas nos sete registros, inclusive nesse par. No código local, [identidadeConhecida](../../../src/lib/wiki/automacao.ts) compara chave/alias exatos; o [diagnóstico](../../../src/lib/wiki/observabilidade.ts) compara palavras de título/alias. O sufixo repetido altera esses conjuntos. Isso explica uma limitação compatível com os dados; não foi reproduzido o caminho exato de geração nem confirmada a versão do servidor.

Recomendação: consolidar o tema preservando referências e histórico, e corrigir a decisão editorial e a detecção para evitar recriação por sufixo/paráfrase. Nenhuma fusão ou correção realizada.

### P2 — síntese e manutenção do contexto ainda superficiais

Os sete textos contêm apenas afirmações classificadas como explícitas. A maioria dos parágrafos reformula uma anotação isolada, introduzida por “Uma nota” ou equivalente. Há integração de fontes em Criptoeconomia e Bitcoin, inclusive uma afirmação de Bitcoin com duas evidências, mas as relações entre tecnologia, ativo, representação por tokens e organização dos mercados ficam principalmente numa lista de links.

Todos os sete registros têm `lacunas: []` e `divergencias: []`. Isso não prova que existam contradições ignoradas: não foi encontrada uma contradição direta entre essas 23 afirmações. Há, contudo, limites visíveis que poderiam gerar perguntas úteis. Por exemplo: data e significado do valor atribuído ao Bitcoin, alcance da caracterização de descentralização em termos de governo e distinção entre definição de uma anotação e explicação geral validada.

As notas de origem têm datas textuais de fevereiro a abril de 2025; o valor quantitativo repetido em 4869 e 4870 não carrega essa data no texto derivado. A atribuição à anotação evita apresentá-lo diretamente como medição atual, mas ainda falta contexto temporal. Esta revisão não verificou cotação, volume de transações ou definições financeiras externamente.

Recomendação: construir parágrafos que expliquem relações sustentadas, separar inferências quando necessárias e registrar perguntas/limites sem inventar respostas. A exigência não é aumentar o número de fontes nem criar inferências artificiais.

### P3 — referências cruzadas podem servir melhor à leitura

Há 29 ligações direcionadas, todas entre os sete ids existentes; nenhum deles é órfão nesse recorte. Sete ligações não têm volta explícita no destino. Reciprocidade total não é uma obrigação do LLM Wiki: no código local, a garantia recíproca vale especificamente para propostas irmãs da mesma resposta.

O problema editorial mais concreto é a relação expressa no texto que não aparece como link direto: 4872 menciona Web 3, mas não liga a 4875. Blockchain não liga diretamente a Tokenização nem a Web 3, embora essas páginas o apontem. As listas não explicam o papel de cada vizinho.

Recomendação: completar relações úteis e nomeá-las no corpo, por exemplo Bitcoin como ativo/rede que usa blockchain; blockchain como infraestrutura relacionada à representação e transferência descritas nas outras notas. Conferir suporte e marcar interpretação quando a frase exceder o que as origens dizem. Não ligar tudo indiscriminadamente.

## Verificações objetivas e limites

- As 25 citações correspondem exatamente aos trechos nas posições `inicio:fim` das notas atuais.
- As oito origens existem, não são neurônios gerenciados e suas revisões coincidem com as registradas em `conceitos_wiki.origens`.
- Todos têm resumo de uma linha e política editorial `rede-v5`; nenhum está protegido ou pausado no snapshot consultado.
- A origem Bitcoin 2641 identifica `#ChatGPT` no próprio conteúdo. É uma nota importada da pessoa, mas não deve ser interpretada como fonte externa independente validada. As demais notas temáticas remetem ao mesmo material de slides; oito notas não equivalem a oito fontes independentes.
- Correspondência literal demonstra rastreabilidade, não verdade externa nem independência das fontes. Não foi comparada a base com um backup para provar imutabilidade histórica das origens.
- Não foram executados chat, navegação no aplicativo, testes de software, processamento da fila, migração, escrita remota, fusão, commit ou push. A revisão não mede a qualidade do restante do acervo nem certifica o ciclo completo de índice/log do aplicativo.

Registro local: somente esta avaliação e os ponteiros da MemWiki, preservando alterações preexistentes.
