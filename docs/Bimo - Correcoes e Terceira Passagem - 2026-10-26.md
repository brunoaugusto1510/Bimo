# Bimo — correções editoriais e terceira passagem

## Escopo

Autorização: corrigir os problemas identificados na segunda passagem, incluindo a síntese do PDF, divergências inválidas, citações incompletas e consistência entre conservar/adiar. Política `sintetica-v4`, branch `fix/processamento-acervo-wiki`. Nenhuma migração, tela, alteração de agendamento, aumento de teto, fusão ou exclusão. Sem commit/push nesta execução.

## Correções de funcionamento

- Divergência nova exige dois IDs distintos e existentes após as operações da proposta. IDs inexistentes, posição nova inválida, afirmação retirada ou par que colapsa no mesmo ID recusam a proposta.
- Se já existem dez pares, outro par distinto é recusado por limite; não desaparece silenciosamente. Propostas irmãs válidas continuam publicáveis, mantendo a origem em revisão e o consumo real registrado.
- Ao substituir apenas as evidências de uma afirmação, preservando exatamente texto e natureza, a divergência anterior é remapeada para o ID resultante. Alterar a proposição exige reconfirmar explicitamente o par; sem isso, a proposta é recusada. Retirar explicitamente uma afirmação encerra os pares dependentes dela.
- Instruções exigem afirmações específicas e citações que sustentem cada condição, resultado e relação de ordem. Uma evidência nova da mesma origem/revisão pode completar a sustentação; não é necessário inventar outra fonte ou duplicar a proposição.
- Código com erro não implica adiamento automático quando é compreendido como rascunho sem ganho sustentado. Notas pessoais integralmente iguais recebem uma indicação de equivalência, independentemente dos títulos.
- Existir documentação pessoal abrangente não basta para concluir que não há ganho de síntese. A avaliação deve considerar mecanismo, fluxo e decisões, preservando a distinção entre fonte pessoal e destino gerenciado.

O validador confirma citações e referências estruturais, mas **não certifica automaticamente toda a interpretação semântica**. Não foi introduzido um juiz LLM nem chamada paga adicional obrigatória. A granularidade das afirmações e as decisões editoriais ainda exigem revisão por amostra.

## Correção revisada do PDF — executada

Aplicada em 26/10/2026, **10:40:28–10:40:32 de Brasília** (13:40:28–13:40:32 UTC), sem inferência. Neurônio **3507**, revisão **1→2**, preservado como página gerenciada.

Uma substituição corrigiu a afirmação: no código fornecido, a tentativa de excluir o objeto do S3 ocorre **antes** do retorno do JSON. Quatro acréscimos separaram download, extração e tratamento de exceção e registraram a descrição de `file_name` na documentação pessoal. A descrição do prefixo não prova, sozinha, que duas versões se contradizem: ficou como pergunta contextual, com a fonte 2879 agora citada. Total: seis afirmações e três raízes pessoais (2590, 2614 e 2879).

A proposta foi revisada contra o código e passou por conferência somente leitura de schema e citações. O executor exigiu origem 2590/revisão 1/hash esperado, documentação 2879/revisão 1 e alvo 3507/revisão 1. Antes de concluir, exigiu exatamente uma publicação no alvo/revisão esperados; a transação normal revalidou revisões e fontes. Não se usou edição pessoal de nota nem SQL direto.

Snapshot cifrado: `.vercel/ensaio-neuronios/registro-1793022028206.json`. Conferência: **zero alterações nas 389 origens**, somente 3507 alterado entre os neurônios anteriores e **zero chamadas OpenAI**. Consumo diário permaneceu 129.889 tokens.

## Passagem com modelo real — executada

Quatro origens reavaliadas na revisão 1, sem editar conteúdo: 2592, 2595, 2591 e 2594. Execução **10:41:23–10:42:00 de Brasília** (13:41:23–13:42:00 UTC), motor real da Wiki contra o Supabase de produção, `gpt-6-luna` e política v4.

| Origem | Resultado e análise |
| --- | --- |
| 2592 — Funcionalidade API Bling | Conservada. O motivo passou a tratar da suficiência do contexto/fluxo, em vez de apenas alegar que já existe documentação pessoal. Continua sendo uma decisão conservadora discutível; este ensaio não comprova que seja a melhor decisão para todo o material de Bling. Não foi criada uma página apenas para atingir uma contagem. |
| 2595 — Middleware | Enriqueceu **3508**, revisão **1→2**, substituindo duas afirmações com evidências mais completas. A citação de consulta agora inclui condição e retorno HTTP 401; HMAC, inclusão de parâmetros e encaminhamento têm trechos próprios. A revisão posterior identificou a perda da divergência antiga ao trocar os IDs, corrigida no motor e tratada na restauração pontual abaixo. |
| 2591 — Fatorial | Conservada como tentativa inconsistente de MDC, sem criar uma página de fatorial a partir do título. |
| 2594 — MDC | Também conservada como rascunho sem sustentação para uma implementação correta. Saiu de revisão; os dois exemplos de conteúdo idêntico tiveram o mesmo tipo de decisão nesta amostra. |

| Medida | Antes | Depois da passagem |
| --- | --- | --- |
| Notas pessoais elegíveis | 389 | 389 |
| Leituras concluídas | 37 | 38 |
| Pendentes | 351 | 351 |
| Impedidas | 1 | 0 |
| Neurônios distintos | 17 | 17 |
| Tokens comprometidos no dia | 129.889 | 171.027 |
| Saldo diário | 70.111 | 28.973 |

Foram **quatro chamadas, 41.138 tokens, um enriquecimento e três conservações**, sem criação ou exclusão. Snapshot cifrado `.vercel/ensaio-neuronios/registro-1793022083595.json`: zero alterações nas origens; somente 3508 mudou entre os neurônios anteriores. Nenhuma leitura dirigida foi solicitada nesta amostra.

## Restauração revisada do middleware

A passagem identificou uma lacuna real: substituir uma afirmação alterava seu ID e podia apagar a divergência antiga. Dois testes reproduziram a perda; a correção agora preserva mudanças somente de evidência e exige reconfirmação quando muda a proposição. A revisão independente não encontrou novos bloqueadores.

A restauração foi preparada para o alvo 3508/revisão 2, com origens 2595/revisão 1/hash esperado e 2799/revisão 1. A conferência somente leitura passou. Ela preserva as três afirmações, completa a evidência da documentação e reinsere o par entre os IDs atuais, sem inferência.

**Aplicada em 26/10/2026, 10:58:38–10:58:43 de Brasília** (13:58:38–13:58:43 UTC). Alvo 3508, revisão **2→3**; três afirmações mantidas, um par restaurado entre os IDs atuais e evidência da documentação reforçada. A afirmação documental continua com o mesmo ID e passa de três para quatro evidências, com o trecho completo sobre os parâmetros da requisição.

Snapshot cifrado `.vercel/ensaio-neuronios/registro-1793023118851.json`: zero alterações nas 389 origens, somente 3508 alterado entre os neurônios anteriores, zero chamadas OpenAI. Consumo permanece 171.027 tokens; saldo 28.973. Estado final: **17 neurônios, 38 leituras concluídas, 351 pendentes e nenhum trabalho impedido**. As duas correções revisadas sem inferência usaram a fila e publicação normais, com conferência de revisão antes de concluir e revalidação transacional de fontes.

## Publicação final

Build **READY** `dpl_3FNSHySPCz1hun2tJouBPQQXn62Z`, promovido e confirmado no alias **bimo-omega.vercel.app**. URL imutável: `https://bimo-is381memz-brunoaugustomaciel-6530s-projects.vercel.app`. Login retornou 200; APIs `/api/wiki/cerebro` e `/api/wiki/processar` recusaram acesso sem sessão/segredo com 401. Build inclui o remapeamento e a exigência de reconfirmação após mudar uma proposição. Não foram aferidos fluxo completo no navegador, duração exata do build, logs de produção ou drains de monitoramento.

A primeira publicação v4, `dpl_7zpZ7mtACAusTT74UjdUbXMaJ62U`, foi usada na passagem paga. A perda de relação descoberta nela motivou a correção final. **Não houve outra inferência paga após o último ajuste**: seu comportamento foi validado nos testes e a restauração real passou pela publicação transacional. A versão anterior à rodada era `dpl_4DT8PvJpEpu7MwaBYkc68RKtqPL8` (v3). Reverter código não desfaz revisões de neurônios; não executar exclusão de dados como reversão.

## Validação e limites

**255 testes em 24 arquivos da Wiki passaram** no estado final do motor, incluindo persistência local em PGlite, consumo, publicação parcial, concorrência e dez testes de divergência. Os cenários do teto e da preservação após substituições tiveram reprodução RED antes da correção. TypeScript identificou uma referência opcional em um teste, corrigida sem alterar a lógica; **TypeScript, ESLint dos arquivos alterados e diff check passaram** na verificação final. Suítes destrutivas de integração com o Supabase real não foram executadas.

A amostra participou da calibração. As decisões de Bling e a atomização do texto ainda merecem avaliação com exemplos inéditos; maior número de páginas não é critério de sucesso. Não foi refeito o acervo inteiro nem prometida remoção automática dos neurônios considerados fracos.
