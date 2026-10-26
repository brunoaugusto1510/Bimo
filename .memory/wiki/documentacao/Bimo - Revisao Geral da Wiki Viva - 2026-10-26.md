# Bimo — revisão geral da Wiki Viva

Data: 26/10/2026. Base: `main` no commit `30366d4`. As correções estão no commit `87b6da8`, na branch `fix/revisao-geral-wiki-viva`, ainda não enviada ao GitHub.

## Escopo e método

Pedido: analisar e testar todo o processo da Wiki Viva depois das correções feitas pelo Codex.

- Quatro revisões independentes, somente leitura: execução (fila, orçamento, lotes, Cron e autenticação), geração e validação (política editorial v4), persistência (migrações 0007–0011, isolamento por `user_id`, APIs) e telas e grafo.
- Uma revisão do Codex sobre o diff das correções, que apontou dois defeitos nas mudanças de tela; ambos foram corrigidos.
- Um teste de jornada, `src/lib/wiki/jornada.test.ts`, que roda o mesmo roteiro em memória e em Postgres local (PGlite, migrações 0007–0011 reais). O modelo é simulado e só enxerga o que o servidor entrega. Nada foi executado contra o Supabase de produção nem contra o modelo real.

O roteiro cobre: notas viram neurônios na pasta `Neurônios`, com evidências no trecho exato (inclusive em trechos além dos primeiros 8 mil caracteres); reler sem mudanças não chama o modelo; Cérebro, Diário e energia contam a mesma história; ligações entre neurônios e arestas do grafo; edição do usuário protege o neurônio, e "devolver ao Bimo" exige a revisão certa; a origem muda e a afirmação é trocada; pausar impede escrita; uma nota que manda apagar e ligar tudo não consegue forjar ligação, tocar neurônio protegido nem citar texto inexistente; renomear uma nota de origem e uma nota ligada não quebra nada. Os 20 testes passam nos dois repositórios, com comportamento idêntico.

## Corrigido (commit `87b6da8`)

Execução e orçamento:

- Erro 5xx do provedor não consome mais o teto diário, porque nada foi gerado nem cobrado. Falha de rede e prazo estourado seguem contando a reserva, pois a chamada pode ter sido cobrada.
- O lote continua depois de uma nota adiada por decisão editorial e ainda para em falha temporária ou de configuração do provedor, para não gastar tentativas de outras notas.
- A verificação local das sínteses roda uma vez por lote e não derruba a fila se falhar.
- Um limite diário de energia inválido não derruba o Cérebro: a energia fica indisponível e o resto aparece.
- Um trabalho que perde a posse três vezes registra `PosseExpirada` em vez de parar sem causa.

Consistência dos dados:

- Renomear, mover ou reescrever links de uma nota de origem não deixa mais o neurônio "Reconsolidando" para sempre: `conceitos_wiki.origens` acompanha a revisão de organização, em memória e em Postgres.
- Proteger ou pausar um neurônio durante a leitura devolve a nota de origem à fila (conflito 409) em vez de prendê-la em "revisar" com o custo perdido.

Validação das propostas:

- Só a nota que sustenta uma afirmação pode trocá-la ou retirá-la. Outra nota que discorda registra divergência, e a regra vale no servidor e no prompt (decisão 2-a abaixo).
- Evidências preservadas mantêm a posição guardada quando o trecho continua onde estava, em vez de saltar para a primeira ocorrência de uma citação repetida.
- Ids de ligação inventados não ocupam o limite das válidas.
- Títulos novos ignoram caracteres invisíveis e de direção de texto e evitam repetir o de uma nota que está em pasta. Na raiz o título segue livre, porque ali a nota já vence a resolução de um `[[Título]]` solto.

Testes: dez testes antigos foram reescritos porque tratavam como válido que uma nota nova corrigisse o que outra afirmava; a mecânica de trocar e retirar por id passou a ser testada com a releitura da própria nota de origem. Há testes novos de regressão para cada correção, e cada um foi confirmado por mutação (falha quando a correção é desfeita).

## Decisões do usuário nesta revisão

1. Relatório e nota de ordem de deploy ficam em `.memory/wiki/documentacao/`.
2. Retirar ou substituir afirmações: só a nota que as sustenta. Outra nota registra divergência.
3. Sem checagem lexical das evidências. Hoje basta o trecho citado existir na nota; o texto da afirmação não é conferido contra as citações. É um risco aceito: uma afirmação composta pode passar com uma citação estreita.
4. Sem resposta, adotada a recomendação: documentar a ordem de deploy da migração 0011 (abaixo).

## Nota de ordem de deploy da migração 0011

A 0011 troca o texto completo das fontes por hashes e trechos, e o backfill descarta o texto integral. Não há reversão. O código anterior lê `fonte.conteudo` e lança erro no formato novo. Portanto:

- Aplicar a 0011 com o código antigo ainda no ar e `WIKI_AUTOMATICA_ATIVA=1` quebra a leitura das sínteses, a ferramenta de evidências do chat e a geração, e o Cron ainda gasta a chamada paga antes de falhar.
- Um rollback do código depois da migração tem o mesmo efeito.
- Ordem segura: desligar `WIKI_AUTOMATICA_ATIVA` (e, se preciso, `WIKI_VIVA_ATIVA`), fazer backup, aplicar a migração, publicar o código novo, reiniciar as instâncias (a sondagem das tabelas fica em cache por processo) e só então religar as variáveis.
- Alternativa não adotada: publicar antes um leitor que aceite os dois formatos e migrar depois.

## Achados abertos

Média gravidade:

- A fila em memória e a do banco divergem em códigos de status, na contagem de cobertura, em `reconciliar` (a memória não emite o evento `despertar`) e em `registrarDiagnostico` (a memória não faz o controle de concorrência). Falta uma suíte de contrato da fila rodando nos dois adaptadores.
- Na leitura dirigida, se a segunda reserva é negada por falta de saldo, o resultado pago da primeira chamada é descartado. O prazo de 40 s é compartilhado entre as duas chamadas.
- A posse do trabalho dura 120 s e não é renovada; há centenas de consultas sequenciais por chamada ao preparar propostas.
- Uma afirmação fica "desatualizada" quando o hash da fonte muda, mesmo com a citação intacta, e fica livre de teto de remoção. O teto também vale por proposta e pode ser contornado em ondas. Não há contador acumulado por neurônio.
- Perguntas em aberto, afirmações sem evidência localizável e pares de divergência herdados podem sumir sem evento no Diário.
- A política RLS de `paginas_wiki` é `FOR ALL`, mais permissiva do que o documento de operação diz, e falta chave estrangeira composta por dono.
- Uma nota de origem renomeada durante a chamada ao modelo gasta uma chamada paga (a revisão da origem avança e a publicação é recusada).
- A busca do agente (`consulta.ts`) casa por substring sem filtro de palavras comuns, e uma edição trivial na fonte esconde todas as evidências dela.

Baixa gravidade: `eventos_wiki`, `paginas_wiki` e `consumos_wiki` crescem sem limite; `gerenciar` e `pausar` reabrem trabalhos bloqueados por configuração; `retomar` não renova a chave do evento de falha do Diário; logs de `/api/notas/*` imprimem o erro bruto; `src/lib/notas.ts` escreve sem o lock e sem acompanhar a wiki (sem chamadores em produção); a descrição "uma citação sem suporte derruba a afirmação" no documento de operação vale só no contrato legado, e na produção ela derruba a proposta inteira.

Telas (relatório de telas, não corrigido neste commit): nenhum error boundary e JSON do servidor tratado como tipado; estados do neurônio no grafo pouco distinguíveis, e "seu" quase invisível no tema claro; legenda dos seis estados ausente; filtro "Precisam de você" inclui estados que não pedem ação; polling duplicado do Cérebro; paginação do Diário perde foco e scroll e não volta uma página.

## Limites desta verificação

- As telas foram corrigidas em parte (Diário com janela viva, conflito 409 que recarrega, falha de rede sem apagar a tela, neurônio novo chegando ao grafo, `aria-disabled`), mas essas mudanças não entraram no commit porque outra sessão estava reescrevendo os mesmos arquivos de tela. Elas só foram validadas com testes de componente, TypeScript e lint, nunca no navegador.
- Em 26/10/2026, ao fim da verificação, os testes de lib e app passaram (1.727 testes), com ESLint limpo. Havia 4 falhas de teste e 2 erros de tipo, todos em telas e em testes de desenho do grafo ainda em reescrita.
- Um teste de desempenho de ligações em massa (`indice-de-ligacoes.test.ts`, limite de 2 s) falhou uma vez sob a carga das revisões em paralelo e passou isolado.
- O teste de jornada usa um modelo simulado e dados fictícios. Não prova a qualidade das sínteses reais.
- As migrações 0007–0011 foram executadas apenas em PGlite, com uma conexão. A contenção entre conexões de um pool remoto não foi exercitada.
- `docs/` foi movido para `.memory/wiki/documentacao/` e `CLAUDE.md`, `AGENTS.md` e `README.md` ganharam as instruções da MemWiki em outra sessão. O `CLAUDE.md` ainda manda o andamento para `docs/`.
