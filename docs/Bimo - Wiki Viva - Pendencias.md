# Bimo — Wiki Viva: o que falta

Atualizado em 26/10/2026, após processamento em lotes, política editorial v4 e ensaios reais de criação/edição.
O que já está feito e como operar fica em `Bimo - Wiki Viva - Operacao.md`; o desenho das telas está no
artefato "Bimo — Wiki Viva: conceitos e telas" (https://claude.ai/artifact/Jr5HEw8UqmRFsVJDQBEVFy).
Vocabulário do artefato: neurônio = síntese, sinapse = evidência, consolidação = reprocessar após 90 s sem digitar,
energia = orçamento diário. No código os nomes continuam síntese, evidência e orçamento.

## Já feito (para não repetir)

- Fila durável, orçamento diário, validação por proposta, janela de estabilidade, sonda de migração.
- Protótipo manual removido; índice compacto de sínteses e recuperação por termos característicos.
- Ids de afirmação com manter, substituir e retirar (`3936ea0`).
- Ligações entre sínteses (`[[links]]` no texto, ids em `paginas_wiki.estrutura`) e perguntas em aberto como dado;
  conferência dos destinos dentro da transação de publicação (`c3da565`).

## Decisões confirmadas pelo usuário em 23/10

1. **Pasta própria:** novas sínteses nascem em `Neurônios`. As existentes mantêm a pasta atual; o papel vem dos metadados.
2. **Vercel Hobby:** GET protegido por `CRON_SECRET` e execução diária, às 05:00 UTC, preparada em `vercel.json`.
   Na revisão de 25/10, GET e POST passam a percorrer um lote de até 25 rodadas, respeitando duração e orçamento. A aceleração após atividade continua com uma rodada.
3. **Telas incluídas no escopo:** referência recebida no HTML "Bimo — Wiki Viva conceitos e telas", com 17 pranchas. Implementadas na página principal, com os tokens existentes.

## Situação desta implementação

- [x] Diário transacional e GET por período/cursor.
- [x] Diagnóstico local periódico sem modelo e eventos sem repetição por rodada.
- [x] Snapshots compactos, SHA-256, backfill 0011 e leitura compatível com o legado.
- [x] Estados, pausa com revisão e divergências estruturadas com ids de afirmação.
- [x] GET do cérebro com contagens, cobertura e energia/renovação.
- [x] Dados do grafo identificam neurônios, sinapses e ligações entre neurônios, sempre derivados do texto.
- [x] Cérebro, Diário, neurônio aberto e aparência do grafo, conforme o arquivo visual recebido.
- [x] Aplicar migrações 0007–0011, configurar e publicar na Vercel, confirmar o Cron e executar piloto real (duas notas, um neurônio).
- [x] Rever a cadência da carga inicial: executor em lotes, limites de tempo/rodadas, retomada persistida e contagens no executor.
- [x] Critérios de utilidade/ganho/destino, conservação/adiamento, reforço de evidência, limpeza explícita de perguntas e procedência editorial.
- [x] Leitura dirigida limitada, retomada operacional por ID/revisão e distinção entre fontes pessoais e destinos gerenciados.
- [x] Recusar divergências inválidas ou acima do teto e preservar/reconfirmar relações após substituir afirmações.
- [x] Ensaios reais documentados e correções revisadas do PDF e do middleware, sem alterar as origens.
- [ ] Completar o processamento inicial e ampliar a avaliação com exemplos inéditos. Fotografia final de 26/10: 389 origens, 38 leituras concluídas, 351 pendentes, nenhum trabalho impedido e 17 neurônios. As 383 notas e a cobertura 2/383 pertencem ao piloto histórico de 23/10.
- [ ] Avaliar a recuperação de candidatas pouco relacionadas, a atomização das afirmações e a decisão conservadora de Bling em uma amostra independente.
- [ ] Escolher/implementar os modos do brainstorming, se aprovados: seleção manual, revisão integral, diário e demais propostas. O arquivo de modos não significa que esses controles já existam.

## Plano do que falta (ordem sugerida)

### 1. Log legível e diário ("Enquanto você estava fora") — backend concluído
- Tabela `eventos_wiki` (dono, tipo, síntese, nota de origem, texto curto, criado em), gravada na mesma transação da publicação.
- Tipos do artefato: nasceu, cresceu, discordam, precisa de você, "li e não havia nada novo", despertar das notas antigas, energia.
- Endpoint de leitura por período e tela do diário com paginação por cursor.
- Regra do repositório: todo query filtra `user_id`.

### 2. Lint periódico das sínteses — concluído
- Rodar junto do executor, sem chamar o modelo quando possível. Verifica: sem raízes (todas as origens removidas),
  tensão (divergências registradas), duplicatas (aliases e títulos parecidos), síntese protegida com notas novas relacionadas,
  ligação para síntese removida.
- Resultado vira evento do diário e estado da síntese (item 4).

### 3. Cortar as cópias completas de origem em `paginas_wiki.fontes` — concluído no código
- Novos snapshots guardam id, título, pasta, revisão, hashes e só os trechos citados. O conteúdo completo não é replicado.
- `conferirFontes` compara hash integral e revisão/organização; leitura tolera reescrita de destinos dos wikilinks.
- Migração `0011_wiki_observabilidade` preparada e testada em PGlite, incluindo backfill Unicode e compatibilidade com o legado.
  Aplicada no Supabase em 23/10/2026, após backup criptografado das notas e versões.

### 4. Estados do neurônio e divergências estruturadas — concluído no backend
- Estados disponíveis: vivo, reconsolidando, seu, em tensão, sem raízes e em pausa; alertas podem coexistir com o estado.
- Divergências são pares de ids de afirmação com o contexto de cada lado. Na política v4, referências inventadas ou pares inválidos recusam a proposta; mudanças na proposição exigem reconfirmação e alterações somente de evidência preservam a relação.
- "Devolver ao Bimo" já tem endpoint (`/api/wiki/gerenciamento`).

### 5. Resumo do cérebro — concluído
- Endpoint com números: neurônios, sinapses, energia restante e hora de renovar, notas lidas (ex.: 362 de 383), em consolidação.

### 6. Grafo — dados e apresentação concluídos
- Marcar neurônios no dado do grafo (`NoDoGrafo`, `montarGrafoDeNotas`) e classificar arestas: cinza entre notas,
  azul fina para sinapse, azul grossa para ligação entre neurônios. Arestas continuam derivadas do texto; nada espelhado em `relacoes`.
- `GrafoDeFundo` e `Chat` não podem remontar (sem `key` nem ramo novo); cores do grafo relidas quando `data-tema` muda.
- Anel duplo, seis estados, filtro Tudo/Só neurônios e nascimento progressivo com respeito a movimento reduzido.

### 7. Telas — implementadas
- Neurônio aberto (afirmações, painel de sinapses, "Onde suas notas divergem", "Perguntas em aberto"), Cérebro, Diário,
  abertura de neurônios pelas referências do chat e nascimento no grafo. Tokens em `globals.css`, sem cores literais.
- Edição pelo editor existente; pausa/retomada e devolução ao Bimo usam revisão-base, com conflito explícito.
- Validação visual local em desktop/celular e temas claro/escuro com dados simulados. APIs autenticadas e piloto com modelo real conferidos em produção em 23/10; a avaliação visual com o acervo real e a amostra ampliada de qualidade continuam pendentes.

## Pontos menores tratados

- **Retirar ligação:** `ligacoesRetiradas` libera vagas e só aceita ids vistos na candidata.
- **Pasta do link:** referências explícitas à raiz e codificação dos delimitadores preservam pastas existentes e resolvem homônimas.
- **Síntese antiga sem perguntas na estrutura:** o primeiro enriquecimento recupera a seção "Questões em aberto" do markdown.
- **Sondagem em cache:** resultados negativos expiram em 30 segundos; a automação espera as colunas/tabelas da 0011 antes de gastar.
- **Teste instável:** a suíte de título verifica os resultados corretos e o limite em cinco mil notas, sem depender de 500 ms de relógio.
- **Vitest e worktrees:** a configuração coleta somente testes de `src`/`scripts`, excluindo `.claude/**`; skills e worktrees não entram na suíte do Bimo.
- **Ativação concluída:** migrações 0007–0011 aplicadas no Supabase, configuração habilitada e produção publicada em 23/10/2026.
  O piloto confirmou criação, evidências, grafo e Diário. A comparação com o backup confirmou as 383 notas originais intactas.
