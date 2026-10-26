# Bimo — entrega consolidada da Wiki Viva

Data: **26/10/2026**. Origem: `fix/processamento-acervo-wiki`, a partir de `2e4249f`. Este documento reúne as mudanças preparadas para integração à `main`; o histórico Git registra os commits e a integração efetivamente concluída. O registro de andamento continua no [Plano de Notas no Banco](./Bimo%20-%20Plano%20de%20Notas%20no%20Banco.md).

Commits de implementação separados por função: `419db06` (processamento em lotes), `a9640aa` (política editorial, leitura dirigida e integridade) e `6607cb9` (ferramentas de avaliação). A documentação consolidada forma um commit próprio; seu identificador e o da integração são consultáveis no histórico da entrega.

## 1. Processamento do acervo em lotes

O GET autenticado do Cron e o POST do executor passam de uma rodada isolada para até **25 rodadas sequenciais** por requisição. O lote para por limite, prazo, cancelamento, orçamento, impedimento ou falta de trabalho pronto. Abre novas rodadas até 180 segundos, sinaliza prazo aos 240 e dispõe de 300 segundos na rota.

Cada rodada preserva as transações, a posse e as reservas existentes. Textos longos continuam por cursor; dependentes podem exigir ondas adicionais. Vinte e cinco rodadas não significam vinte e cinco notas integralmente lidas. A resposta traz progresso do lote e cobertura das origens. O executor externo acompanha os prazos, imprime apenas contagens e reduz a frequência de consultas quando está ocioso ou sem saldo.

O Cron Hobby permanece diário, às 05:00 UTC; o teto permanece em **200.000 tokens por dono/dia UTC**. A aceleração após atividade continua com uma rodada. Não foi instalado um trabalhador permanente.

Arquivos: `src/lib/wiki/lote.ts`, `lote.test.ts`, `execucao.test.ts`, `src/app/api/wiki/processar/route.ts`, `scripts/executar-wiki.mjs` e comentário operacional em `.env.example`.

## 2. Política editorial e operações de edição

Política atual: **`sintetica-v4`**. Uma publicação exige justificativas de utilidade, ganho e destino, com avaliação suficiente nos três critérios. Conservar na origem e adiar são decisões explícitas; criar uma página não é obrigatório. Não há mínimo arbitrário de fontes, tamanho ou número de afirmações.

- Enriquecimento exige destino gerenciado lido. Um título somente no índice não permite edição às cegas. Identidade já conhecida impede criação duplicada.
- `reforcos` acrescenta evidência à afirmação visível, preservando ID lógico, texto e natureza. Repetir o mesmo trecho não gera revisão. Uma evidência complementar pode vir da mesma origem e revisão.
- `limparLacunas` permite remover explicitamente todas as perguntas. Lista vazia sem esse comando conserva as existentes.
- Propostas irmãs válidas podem ser publicadas mesmo quando outra falha. Publicação e estado de revisão são atômicos; a origem não fica falsamente concluída nem repete automaticamente a parte recusada.
- Publicações guardam política, justificativas, origem/revisão/trecho no JSON de estrutura existente. Conservação e adiamento registram motivos no Diário privado; logs continuam limitados a categorias e contagens.

Arquivos: `editorial.ts`, `automacao.ts`, `gerador.ts`, `diario.ts`, `tipos.ts`, `automacao-tipos.ts`, `fila-banco.ts`, `fila-memoria.ts` e os repositórios `banco.ts`/`memoria.ts`. Testes em `editorial.test.ts`, `gerador.test.ts` e `persistencia.test.ts`.

## 3. Leitura dirigida e reavaliação explícita

O contexto distingue fonte pessoal, neurônio lido e neurônio somente no índice. Leituras parciais são sinalizadas. Documentação pessoal pode fornecer evidência para uma nova síntese; não se torna destino de edição só por explicar o mesmo assunto.

Um adiamento por leitura de neurônio deve indicar até três IDs do índice ainda não lidos. O servidor verifica os IDs, lê novamente metadados e proteções e oferece **uma continuação**, com no máximo duas chamadas por trecho e prazo compartilhado de 40 segundos. Cada chamada tem reserva e consumo próprios. Pedir nota pessoal como neurônio ou repetir uma leitura oferecida é recusado.

Quando falta saldo para o contexto inicial, o motor reduz candidatas e índice menos prioritários, preservando origem, dependentes selecionadas e leituras solicitadas. Se a reserva restante não cabe, para antes da inferência. O teto não aumenta.

A operação interna `reprocessar(notaId, revisaoBase)` abre nova geração para uma origem específica, sem editar a nota. Confere dono, revisão, ausência de posse ativa e bloqueio de configuração; recusa neurônios como origem. `reivindicar(notaId)` permite ao executor operacional consumir somente o trabalho escolhido. Não foi criada tela ou rota pública para essa operação.

Arquivos: `automacao.ts`, `automacao-tipos.ts`, `recuperacao.ts`, `fila-banco.ts`, `fila-memoria.ts`, `leitura-dirigida.test.ts` e `persistencia.test.ts`.

## 4. Integridade das divergências e sustentação

Uma divergência nova exige dois IDs distintos, existentes após as operações da proposta. Posição inexistente, ID inventado/retirado, colapso dos dois lados no mesmo ID ou novo par acima do teto de dez recusam a proposta.

Ao trocar somente evidências, mantendo exatamente texto e natureza, a relação anterior acompanha o novo ID. Se muda a proposição, o modelo precisa reconfirmar explicitamente o par. Retirada explícita de uma afirmação encerra os pares dependentes dela. A relação não pode desaparecer silenciosamente por uma substituição de ID.

As instruções exigem afirmações específicas e citações que sustentem condições, resultados e ordem do código. Código e documentação podem formar uma síntese conjunta; diferenças conservam procedência e incerteza de vigência. O sistema não executa o código das notas nem afirma que foi testado.

Notas pessoais integralmente idênticas são sinalizadas, independentemente do título. Erro de sintaxe, sozinho, não implica adiamento de um rascunho compreendido. Documentação abrangente, sozinha, não elimina o ganho de organizar um fluxo ou decisão.

**Limite:** localizar uma citação e validar IDs não comprova toda a conclusão semântica. Não foi acrescentado juiz LLM ou chamada paga adicional obrigatória. A atomização do texto, a recuperação de candidatas e a conservação de Bling continuam merecendo avaliação independente.

Arquivos: `automacao.ts`, `gerador.ts`, `divergencias.test.ts`, `leitura-dirigida.test.ts` e `persistencia.test.ts`.

## 5. Avaliação e documentação versionadas

Os scripts `scripts/avaliar-editorial-wiki.mjs` e `scripts/avaliacao-wiki/{casos,consultas,executar}.ts` conservam a amostra sintética histórica, as perguntas e o executor. Inferência exige `--executar`; reprodução usa arquivos locais e bloqueia rede. O protocolo limita a uma geração por caso, impedindo que a continuação atual ultrapasse o orçamento histórico. Respostas de outra política exigem checkout compatível e são recusadas antes de regravar resultados.

Esses scripts não são o executor do acervo real e não certificam os resultados da v4. Novas medições devem usar rótulo próprio; os agregados v2 são históricos. Não foram iniciadas novas chamadas de avaliação paga nesta consolidação.

| Documento | Conteúdo |
| --- | --- |
| [Modos de consolidação e energia](./Bimo%20-%20Modos%20de%20Consolidacao%20e%20Energia.md) | Brainstorming registrado; modos adicionais não implementados. |
| [Análise de granularidade](./Bimo%20-%20Analise%20de%20Granularidade%20dos%20Neuronios.md) | Diagnóstico das páginas pequenas e critérios de ganho. |
| [Plano de qualidade](./Bimo%20-%20Plano%20de%20Qualidade%20e%20Criterios%20dos%20Neuronios.md) | Plano, parâmetros, execução e limites. |
| [Revisão individual](./Bimo%20-%20Revisao%20Individual%20dos%20Neuronios.md) | Inventário e propostas para os neurônios examinados; propostas não equivalem a fusões/exclusões executadas. |
| [Avaliação editorial](./Bimo%20-%20Avaliacao%20da%20Politica%20Editorial.md) | Amostra sintética e comparação histórica das políticas. |
| [Primeiro ensaio real](./Bimo%20-%20Ensaio%20Real%20dos%20Neuronios%20-%202026-10-25.md) | Seis notas na v2, sem publicação, e problemas identificados. |
| [Segunda passagem](./Bimo%20-%20Segunda%20Passagem%20dos%20Neuronios%20-%202026-10-26.md) | V3: duas criações, um enriquecimento, erros e limites observados. |
| [Correções e terceira passagem](./Bimo%20-%20Correcoes%20e%20Terceira%20Passagem%20-%202026-10-26.md) | V4, correções revisadas e preservação das origens. |
| [Funcionamento e referências Obsidian](./Bimo%20-%20LLM%20Wiki%20-%20Funcionamento%20e%20Referencias%20Obsidian.md) | Pesquisa e comparação datadas de 23/10; não é nova verificação do plugin nem retrato atualizado de todas as mudanças posteriores. |
| [Operação](./Bimo%20-%20Wiki%20Viva%20-%20Operacao.md) / [Pendências](./Bimo%20-%20Wiki%20Viva%20-%20Pendencias.md) | Funcionamento atual, histórico e trabalho restante. |

## 6. Dados e produção já alterados

As operações abaixo foram autorizadas e concluídas antes desta integração Git. Não são executadas novamente por um merge.

- Neurônio PDF **3507, revisão 2**: ordem de exclusão/retorno corrigida; seis afirmações, três raízes; dúvida do prefixo contextualizada e documentada.
- Middleware **3508, revisão 3**: três afirmações mantidas, citações ampliadas, evidência documental completa e divergência restaurada entre os IDs atuais.
- Listagem unificada **3503, revisão 2**: enriquecida na segunda passagem, com duas raízes e distinção de superfícies de listagem.
- Fotografia final de 26/10: **389 origens intactas, 17 neurônios, 38 leituras concluídas, 351 pendentes, zero impedidos**. Consumo diário 171.027 tokens, saldo 28.973. São contagens da medição, não valores fixos do sistema.
- Última publicação confirmada no domínio `bimo-omega.vercel.app`: **`dpl_3FNSHySPCz1hun2tJouBPQQXn62Z`**, build READY, login 200, APIs privadas 401 sem credenciais. Esta publicação antecede os commits da consolidação; eventual deploy disparado pelo push é outro evento.

Os relatórios distinguem inferência real, reprodução local e correções revisadas sem inferência. O último ajuste de preservação foi verificado em testes e na restauração real; não houve outra chamada paga após esse ajuste. Nenhuma migração nova: a entrega usa a estrutura 0007–0011 já aplicada. Reverter código não desfaz publicações do banco.

## 7. Validação e limites da integração

O motor final passou em **255 testes/24 arquivos da Wiki**, além de revisão independente. Na consolidação, a suíte offline ampla passou em **2.020 testes/168 arquivos**. TypeScript, ESLint de `src`/`scripts`, sintaxe dos dois executores JavaScript e diff check passaram. As duas suítes de integração que criam/apagam usuários no Supabase real foram excluídas expressamente. Há avisos de `act`/layout em testes de interface; a execução terminou sem falhas e esses componentes não foram alterados nesta entrega.

O build remoto do código funcional foi validado antes da última publicação. As falhas anteriores de build local no Windows estão documentadas; não são apresentadas como novo build local bem-sucedido. Fluxo integral no navegador, ranking em produção e qualidade de todo o acervo não foram certificados por esta entrega.

## 8. Limites do que sobe para a main

Entram código, testes, ferramentas de avaliação, exemplo de configuração e os documentos acima. Telas e correção anterior do chat já estavam integradas em `2e4249f`; esta rodada não acrescenta telas.

Permanecem locais os arquivos reais de ambiente, segredos, `.vercel/`, snapshots e respostas cifradas, scripts operacionais específicos de notas reais, memórias de agentes e o checkout `.claude/worktrees/login-multiusuario`. Esse checkout contém o trabalho separado de contas/login e não foi integrado nem alterado por esta entrega.

Continuam pendentes: percorrer o restante do acervo conforme os limites atuais, avaliar exemplos inéditos, melhorar a recuperação e escolher os modos do brainstorming. Não foi iniciada reconstrução em massa, exclusão dos neurônios existentes ou mudança de agendamento/energia.
