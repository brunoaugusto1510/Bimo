# Architectural Decisions

*Document major technical decisions, the rationale behind them, and alternatives considered.*

## 26/10/2026 — Documentação do projeto incorporada à MemWiki

Por solicitação explícita, todos os 25 documentos da antiga pasta `docs/` passam a residir em `.memory/wiki/documentacao/`. Os arquivos completos e suas subpastas foram preservados para conservar especificações, evidências e histórico; o [índice da wiki](index.md) oferece navegação por assunto.

Os documentos continuam com seus estados e datas originais. Os registros mais recentes orientam a leitura dos anteriores, sem apagar decisões históricas nem transformar propostas em entregas. README e CLAUDE passam a apontar para os novos caminhos. Novos aprendizados seguem o protocolo MemWiki em `AGENTS.md`.

## 26/10/2026 — Decisões de arquitetura identificadas na ingestão

As entradas abaixo descrevem escolhas já presentes no sistema, observadas no checkout. Não constituem nova autorização de produto ou infraestrutura.

| Escolha existente | Motivo ou consequência observável | Referência |
| --- | --- | --- |
| ID opaco e repositório único de notas | Desacopla identidade de caminho e permite banco/memória sob o mesmo contrato | [Notas e autenticação](dominios/notas-e-autenticacao.md) |
| Revisão otimista e fila de autosave | Preserva alterações concorrentes e organiza as escritas de uma nota | [Interface e grafo](dominios/interface-e-grafo.md) |
| Senha única e cookie assinado no app web | O modelo atual de sessão não representa contas individuais; o plano multiusuário continua uma referência de evolução | [Notas e autenticação](dominios/notas-e-autenticacao.md) |
| Ferramentas de notas mediadas pelo servidor | O agente pode ler e escrever pelos contratos existentes; a substituição exige leitura prévia | [Agente e ingestão](dominios/agente-e-ingestao.md) |
| Conhecimento derivado com evidências das origens | Sínteses acumulam conhecimento sem se tornarem fontes independentes | [Wiki Viva](dominios/wiki-viva.md) |
| Publicador da wiki separado das ferramentas do chat | A manutenção pode enriquecer sínteses gerenciadas sem autorizar edição automática das notas pessoais | [Wiki Viva](dominios/wiki-viva.md) |
| Política editorial estruturada e versionada | Criar, enriquecer, relacionar, conservar e adiar têm contratos e validações distintos | [Wiki Viva](dominios/wiki-viva.md) |
| Recuperação textual e por dependências | A implementação da wiki não exige armazenamento vetorial nem usa o grafo visual como prova de recuperação por caminhos | [Wiki Viva](dominios/wiki-viva.md) |
| Chat e grafo permanecem montados | A troca de modo preserva conversa e simulação | [Interface e grafo](dominios/interface-e-grafo.md) |
| Serviços mobile injetáveis, com padrão simulado | Permite trabalho de interface sem estabelecer integração produtiva com o backend web | [Mobile](dominios/mobile.md) |

## 26/10/2026 (noite) — Wiki Viva em rede, próxima do LLM Wiki do Karpathy (política `rede-v5`)

Decisões do usuário depois da [auditoria da estrutura](documentacao/Bimo%20-%20Auditoria%20da%20Estrutura%20da%20Wiki%20Viva%20vs%20LLM%20Wiki%20-%202026-10-26.md):

1. **O HIGH da auditoria é aceito como comportamento desejado.** Uma nota criada pelo agente do chat (`criar_nota`, autor `agente`) é uma anotação legítima e pode virar raiz de neurônio: o usuário às vezes quer que a IA salve uma nota para ele. A instrução do chat diz para criar a nota quando ele pedir para guardar uma resposta; sem pedido, continua proibido fabricar aprendizado. Isto substitui a recomendação 1 da auditoria (levar autoria à fonte e exigir confirmação), que não será implementada.
2. **Implementar as recomendações sem conservadorismo**, aproximando a Wiki Viva da rede interligada do LLM Wiki:
   - uma resposta do modelo pode ter até seis propostas (antes, três);
   - o prompt pede para enriquecer todos os neurônios afetados, criar páginas para conceitos, entidades, projetos e decisões, montar panoramas e ligar com generosidade;
   - cada neurônio tem um resumo de uma linha, guardado em `paginas_wiki.estrutura.resumo` (jsonb, sem migração), e o índice que o modelo vê traz esse resumo;
   - propostas da mesma resposta se ligam por `proposta:N`, nos dois sentidos;
   - teto de 16 ligações por neurônio (antes, 8);
   - a recuperação traz vizinhos na rede, com 8 candidatas (antes, 6) e índice de até 250 entradas;
   - a consulta do chat segue as ligações (`relacionados`), e o chat ganha a ferramenta `indice_da_wiki` (ler o índice antes, como no padrão);
   - o lint marca neurônios isolados e relê a origem uma vez para ligá-los.
3. **Limites mantidos de propósito:**
   - cada afirmação continua exigindo citação literal da nota de origem;
   - a automação continua sem escrever em nota pessoal;
   - edição manual continua protegendo o neurônio;
   - outra nota não troca nem retira o que uma nota sustenta;
   - o teto de 65 mil bytes de contexto por chamada e o orçamento diário não mudaram;
   - a releitura de neurônio isolado só ocorre com a fila ociosa, se o neurônio já estava isolado na verificação anterior, uma vez por isolamento e no máximo duas origens por verificação. Isso evita uma cascata de leituras pagas.

## 26/10/2026 — Páginas de domínio na MemWiki

A ingestão distribui o conhecimento atual em cinco páginas de domínio, mantendo stack, padrões, decisões e problemas como portas de entrada. Os 25 documentos migrados conservam evidências e contexto histórico. O relatório de verificação registra divergências e limites da ingestão, sem reescrever resultados antigos como fatos atuais.

## 27/10/2026 — Proposta de memória conversacional do aplicativo

Criado o [plano do sistema de memória](documentacao/Bimo%20-%20Plano%20do%20Sistema%20de%20Memoria.md), a pedido de planejamento completo com ECC. **Estado: proposto; nenhuma escolha deste plano está registrada como aprovação de implementação ou retenção.**

Recomendações para revisão: manter Responses API e `store: false`, armazenar conversas e memórias no banco do aplicativo, separar resumos de trabalho de lembranças duráveis e das evidências da Wiki Viva, capturar de forma seletiva e usar recuperação progressiva. Corrigir/esquecer deve invalidar resumos/checkpoints e bloquear reextração das mesmas origens por trabalhos atrasados. Recuperar turno interrompido exige identidade de operação e recibo transacional das escritas, sem repetição cega.

As alternativas e consequências estão na seção 4; as decisões D-01–D-08, na seção 17. A autenticação web observada segue com senha única e dono configurado: preparar `user_id` não cria isolamento entre pessoas que compartilham a mesma sessão. O plano não altera as escolhas aceitas da Wiki Viva `rede-v5` nem a tarefa estacionada de tensões.

## 27/10/2026 — Modos de consolidação e energia: padrão contínuo, orçamento único, autonomia configurável

Decisões do usuário após comparar os modos com o texto do LLM Wiki. Detalhes em [modos de consolidação e energia](documentacao/Bimo%20-%20Modos%20de%20Consolidacao%20e%20Energia.md). **Estado: decididas; nada implementado.**

- **Padrão: contínuo.** Corresponde ao comportamento que a documentação descreve hoje (estabilidade de 90 s, Cron, aceleração por atividade).
- **O lint divide o orçamento diário** com o chat e a ingestão; o orçamento é o medidor universal. Sem cota separada.
- **Autonomia como configuração da pessoa:** *publicar direto* (padrão) ou *propor antes de publicar*, para que cada pessoa controle o próprio gasto. A segunda opção gasta energia mesmo quando a proposta é rejeitada e exige fila e tela de aprovação, ainda inexistentes.

Em aberto: prioridade entre chat, ingestão e lint dentro do orçamento único, orçamento padrão, critérios do lint, interface da fila de propostos.

