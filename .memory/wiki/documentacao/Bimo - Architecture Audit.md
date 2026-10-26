# Bimo - Architecture Audit (Fase 1)

> Documento de trabalho da Fase 1 do roadmap (ver [Bimo - Visão e Direção do Projeto.md](./Bimo%20-%20Vis%C3%A3o%20e%20Dire%C3%A7%C3%A3o%20do%20Projeto.md), seção 22). Registra as decisões conceituais tomadas antes de qualquer migração estrutural. Vai sendo preenchido conforme os pontos do checklist da Fase 1 são fechados.

---

## Checklist da Fase 1

- [x] Definir modelo conceitual do conhecimento
- [x] Definir o que é uma nota
- [x] Definir o que é uma fonte
- [x] Definir entidades
- [x] Definir relações (formato final da tabela, tipos permitidos)
- [x] Definir proveniência (campos obrigatórios, regras)
- [x] Definir versionamento
- [x] Definir responsabilidades do agente
- [x] Definir papel futuro do Obsidian
- [x] Definir arquitetura multiusuário

---

## Decisão 1 — Modelo conceitual: Fonte, Entidade, Nota, Relação

**Contexto:** avaliamos manter tudo como arquivos Markdown puros (modelo Obsidian-like) vs. ter um núcleo estruturado (banco) com o conteúdo em Markdown. Optamos pelo segundo — Markdown continua sendo o formato de conteúdo e de exportação, mas deixa de ser a fonte da verdade estrutural (relações, tipo, proveniência, isolamento multiusuário).

### Fonte (Source)

- Blob **imutável**, preservado exatamente como veio (PDF, HTML, transcrição, texto).
- Nunca é editado depois de ingerida; uma atualização gera uma nova ingestão/versão, não uma sobrescrita.
- Vive em storage de objetos, referenciada por `id`.
- Aplica o princípio "não substituir a fonte original" (seção 23, princípio 1, do doc de visão).

### Entidade (Entity)

- Nó **leve** do grafo de conhecimento: `name`, `type`, `aliases`, `confidence`, `status` (draft / approved / merged).
- Criada majoritariamente pelo **agente**, ao processar fontes (fluxo da seção 15 do doc de visão).
- Pode não ter corpo de texto nenhum — é identidade + relações, não narrativa.
- Ideal para operações em lote do agente (`find_duplicates`, `find_conflicts`, `create_entity`, `suggest_update`), por ser barata de comparar/consultar.

### Nota (Note)

- Documento **pesado**, majoritariamente autoral do **usuário**.
- Corpo em `content: markdown`, versionado, com metadados (`tags`, `created_at`, `updated_at`, `user_id`).
- Pode opcionalmente estar associada a uma ou mais Entidades que documenta em profundidade (ex.: nota "RAG.md" ↔ entidade "RAG").
- Não carrega colunas de workflow do agente (`confidence`, `status`) — isso é problema da Entidade, não da Nota.

### Relação (Relationship)

- Tabela própria, **poligamérfica**: conecta `entity↔entity` (caso principal, ex. `RAG --uses--> Embeddings`), `note↔entity` (nota menciona/documenta entidade) e `note↔note` (herdando o comportamento atual de wikilink).
- O wikilink no corpo do Markdown pode continuar existindo como conveniência de leitura/Obsidian, mas a relação "de verdade" é a linha no banco — o texto não é a fonte estrutural da relação.

**Por que essa divisão (não uma tabela única com `kind`):** Nota e Entidade têm ciclos de vida, criadores e campos diferentes. Uma tabela unificada obrigaria a Nota do usuário a carregar colunas de workflow do agente (`confidence`, `status`) sem sentido para conteúdo autoral, e obrigaria a Entidade a ter um `content` ambíguo quando extraída automaticamente sem prosa nenhuma. Separar mantém `create_note`/`update_note` simples e dá ao agente um objeto pequeno e barato (`Entity`) para trabalho de grafo em lote.

**Como as duas se conectam:**

```text
Fonte (imutável)
   │  (proveniência)
   ▼
Entidade ──relação──▶ Entidade
   │
   │ (documenta)
   ▼
Nota (conteúdo markdown, versionada)
```

---

## Decisão 2 — Proveniência

**Contexto:** proveniência mistura duas perguntas diferentes — *quem/o que criou este registro?* (autoria) e *de qual material bruto isso veio?* (fonte). Separá-las evita ter que tratar "criação manual, sem fonte" como caso especial.

### Camada 1 — Autoria (sempre obrigatória)

Todo Entidade, Nota e **Relação** carrega `created_by: user | agent` (e, se agente, qual ferramenta/tool call gerou). Nunca fica vazia — inclusive relações de baixo risco aplicadas automaticamente (seção 16 do doc de visão) guardam isso, para permitir auditoria posterior mesmo sem exigir aprovação prévia.

### Camada 2 — Fontes associadas (opcional, N:N)

Tabela de junção (`provenance`: `entity_id | note_id`, `source_id`, `linked_at`), não uma FK única — porque uma Entidade se consolida de múltiplas Fontes ao longo do tempo (fluxo da seção 15: agente processa novo material e **atualiza** conhecimento existente).

- Fonte única → 1 linha.
- Consolidada de N fontes ao longo do tempo → N linhas, uma por vinculação.
- Sem fonte nenhuma (criação manual do usuário, ou inferência pura do agente) → zero linhas, mas autoria continua preenchida.

### Granularidade adotada: por documento, não por citação

Proveniência aponta para a Fonte inteira ("isso veio deste PDF"), não para o trecho exato dentro dela ("página 4, parágrafo 2"). Rastreamento em nível de citação (offset/excerpt, necessário para citações clicáveis no retrieval) é mais caro de manter — reprocessar uma Fonte pode invalidar os apontamentos — e só se paga quando a Fase 4 (Retrieval, seção 12) precisar dele. Por isso a tabela de proveniência reserva um campo `locator` opcional/nulo desde já, para não exigir migração de schema depois, mas sem implementar a extração agora.

---

## Decisão 3 — Tipos de relação

**Contexto:** o `type` da tabela de Relação (poligamérfica, Decisão 1) precisava de um vocabulário. Texto livre reintroduziria o mesmo problema que motivou tirar a relação de dentro do wikilink solto: um LLM gerando `type` livre por function calling tende a criar variações quase-duplicadas ("uses", "depends_on", "requires") que quebram consultas confiáveis (`find_related`, `find_conflicts`).

**Decisão:** conjunto fixo e pequeno, estrutural (cada tipo alimenta uma necessidade concreta do agente), não os exemplos ilustrativos da seção 11 do doc de visão (`uses`/`contains`/`improved_by`, específicos demais de domínio técnico):

| Tipo | Significado | Uso pelo agente |
|---|---|---|
| `relaciona_com` | Ligação genérica (equivalente ao wikilink de hoje) | Fallback padrão |
| `parte_de` | Relação hierárquica todo/parte | Navegação estrutural |
| `depende_de` | Pré-requisito / dependência conceitual | `find_related` com direção |
| `deriva_de` | Este item nasceu evoluindo/reprocessando outro | Rastreia consolidação (seção 15) |
| `substitui` | Este item torna outro obsoleto | `find_duplicates` / merge (seção 14) |
| `contradiz` | Sinaliza conflito de informação | `find_conflicts` |

**Fechado para o agente, extensível por decisão humana:** o agente escolhe entre esses 6 via function calling — isso é o que garante grafo consistente e query confiável (princípio 9: não adicionar complexidade sem necessidade real). Se o uso real revelar necessidade de um tipo estrutural novo, adiciona-se ao enum deliberadamente — migração barata, ao contrário de tentar consolidar retroativamente um vocabulário livre que já saiu de controle.

A nuance/explicação específica de *por que* algo se relaciona daquele jeito continua no conteúdo da Nota/Entidade, não em um campo extra na relação — decisão a revisitar depois de observar como o agente usa esses 6 tipos na prática.

---

## Decisão 4 — Versionamento

**Contexto:** a seção 17 do doc de visão pede que o sistema saiba o que mudou, quando, quem mudou (manual ou IA) e permita restaurar versões anteriores — hoje isso é responsabilidade do Git, mas a Decisão 1 já tirou o Git do papel de fonte-da-verdade estrutural. Este item é **desenho conceitual apenas** — a implementação real acontece na Fase 2 (Knowledge Core), já que "nenhuma migração estrutural deverá ocorrer antes" do Architecture Audit terminar.

### Granularidade: snapshot completo, não diff por campo

Cada edição de Nota/Entidade gera uma nova linha numa tabela de versões com o **conteúdo/campos inteiros** daquele momento — não um diff. Diff é calculado sob demanda ao comparar duas versões, nunca armazenado. Isso espelha o próprio modelo do Git (cada commit é uma foto completa) e evita a complexidade de reconstrução que um esquema de diff por campo exigiria — desnecessário na escala de uma base pessoal (princípio 9).

- **Nota / Entidade**: tabela de versões própria, snapshot completo por edição, `created_by: user | agent` em cada versão (reaproveita a autoria da Decisão 2). O registro vivo sempre reflete a versão mais recente.
- **Relação**: não recebe a mesma máquina de versionamento — uma relação existe ou não existe, não é editada incrementalmente. Basta um log leve de auditoria: `created_at/created_by` e, se removida, `removed_at/removed_by`.

### Restauração = nova versão, nunca reescrita

Restaurar uma versão antiga cria uma versão **nova** com aquele conteúdo (como `git revert`), nunca apaga ou sobrescreve as versões intermediárias — preserva a trilha de auditoria completa, inclusive o próprio ato de restaurar.

---

## Decisão 5 — Responsabilidades e autonomia do agente

**Contexto:** a seção 16 do doc de visão define 3 faixas de risco (baixo/médio/alto), mas sem mapear as ferramentas concretas (seção 14) pra cada faixa. Isso só ficou possível de fechar depois de autoria (Decisão 2), tipos de relação (Decisão 3) e versionamento (Decisão 4) definidos — são eles que tornam cada faixa segura.

### Leitura — risco zero, sempre autônomo

`search_knowledge`, `search_sources`, `get_note`, `find_related`, `find_duplicates`, `find_conflicts` — só consultam/detectam, não alteram nada. `find_duplicates`/`find_conflicts` **encontram** candidatos; resolver o que fazer com eles entra em outra faixa.

### Baixo risco — auto-executável, só exige autoria registrada

`create_relationship`, `create_entity`, `create_note` — todos **aditivos**: criam algo novo sem sobrescrever nada existente (exemplo literal da seção 16: "criar uma relação simples... pode ser executado automaticamente"). Rede de segurança: só `created_by` (Decisão 2, Camada 1) — auditável depois, sem aprovação prévia.

### Médio risco — auto-executável, com rede de segurança real

`update_note`, `update_entity` (quando a entidade **não** está `approved`/`merged`), `remove_relationship` — alteram ou desfazem algo que já existia. A seção 16 pede "histórico e possibilidade de reversão" — é o que a Decisão 4 entrega (versionamento completo pra Nota/Entidade, log de remoção pra Relação). Por isso não bloqueiam em aprovação: o custo de errar já é coberto por poder reverter.

### Alto risco — exige aprovação explícita do usuário

- Excluir Nota/Entidade de verdade (diferente de `remove_relationship`, que só desfaz uma ligação)
- Mesclar entidades duplicadas (`substitui`, ligado a `find_duplicates`)
- `update_entity` quando a entidade **já está** `approved`/`merged` — conhecimento consolidado não deveria ser silenciosamente reescrito
- Situações em que o próprio agente identifique ambiguidade genuína (ex.: `find_conflicts` achou uma contradição e não é óbvio qual versão está certa)

`suggest_update` é a porta de entrada pra tudo isso: em vez de executar direto, o agente registra a sugestão (o quê, por quê, o que muda) e a operação real só roda depois de aprovação do usuário. Isso implica uma fila de sugestões pendentes na UI em algum momento — não desenhada agora, fica como implicação pra Fase 5 (Agent 2.0).

### Extensão futura: autonomia configurável pelo usuário

As faixas acima são o *padrão*, não uma régua fixa pra sempre. Fica registrado como direção futura: uma configuração onde o usuário ajusta o quanto o agente pode agir sozinho — por exemplo, deslocando `update_entity`/`remove_relationship` de médio pra "exige aprovação" (mais conservador), ou liberando parte do alto risco pra execução automática com só notificação (mais confiante). Não é desenhado nem implementado agora (YAGNI — não há ainda uso real pra calibrar o controle certo); entra como item da Fase 5/8 quando a UI de sugestões e o modelo multiusuário existirem.

---

## Decisão 6 — Papel futuro do Obsidian

**Contexto:** a seção 18 do doc de visão previa o Obsidian como "integração e formato de exportação" após a migração pro Knowledge Core, com sincronização Bimo → Export → Obsidian. Alinhando diretamente com o Bruno, a intenção real é mais radical: o Bimo não busca interoperar com uma instalação separada do Obsidian a longo prazo — ele pretende **ser** a "versão 2.0" do Obsidian, substituindo-o no uso do dia a dia.

**Decisão:** Obsidian deixa de ser tratado como integração a manter. Ele vira **referência de UX a replicar nativamente** no Bimo, não um destino de sincronização:

- escrita nativa em Markdown de verdade (não WYSIWYG que abstrai o formato);
- atalhos de teclado no estilo Obsidian;
- linkagem visual entre notas (equivalente ao `[[wikilink]]`, ainda que por baixo a relação estruturada da Decisão 3 seja o que efetivamente conecta as coisas);
- grafo visual (já existe hoje, `GrafoDeFundo`).

A camada que o Obsidian não tem e o Bimo adiciona por cima é o agente com alto autoconhecimento da base — sustentado pelas Decisões 1–5 (modelo estruturado, proveniência, versionamento, autonomia por risco).

**Consequência prática:** como não existe uma segunda instalação editável em paralelo, o problema de "reconciliar edição externa" discutido inicialmente **deixa de existir** — não há segunda via de escrita a conciliar. A exportação em Markdown (seção 19 do doc de visão) continua existindo, mas rebaixada a escape hatch de portabilidade (princípio 8), não a roteiro ativo de sincronização.

**Fora de escopo aqui:** como o editor nativo funciona na prática (atalhos específicos, autocomplete de link, etc.) é trabalho de produto/UI de uma fase futura (provavelmente Fase 2, quando Nota vira um registro real do Knowledge Core) — não é especificado nesta etapa de Architecture Audit.

---

## Decisão 7 — Arquitetura multiusuário

**Contexto:** a seção 20 do doc de visão exige que a arquitetura multiusuário seja considerada antes da implementação definitiva do banco/Knowledge Core, para que Fonte, Entidade, Nota, Relação, Proveniência e Versionamento (Decisões 1, 2, 3 e 4) não precisem ser refeitos na Fase 8.

**Decisão:** isolamento **por linha** (`user_id`) em schema compartilhado — não schema/banco separado por usuário (overhead de SaaS enterprise que não se paga na escala atual). Adicionar `user_id` já no desenho do schema da Fase 2, mesmo com um único usuário hoje, é uma exceção deliberada ao princípio 9: o custo de adicionar agora é baixo; o custo de retrofitar depois de haver dados reais (migração de toda tabela, reescrita de toda query, risco de esquecer um filtro) é alto.

**Implicações no que já foi decidido:**

- **Fonte, Entidade, Nota** — cada uma carrega `user_id` desde a primeira migração da Fase 2.
- **Relação** (Decisões 1 e 3) — regra de integridade: `from` e `to` nunca pertencem a usuários diferentes. Não é um FK simples (relação é poligamérfica) — vira checagem/trigger a implementar na Fase 2, não desenhada em detalhe agora.
- **Reforço recomendado:** Row-Level Security nativa do Postgres além do filtro na aplicação — defesa em profundidade. Decisão de abordagem; implementação fica para a Fase 2.

**Fora de escopo desta decisão:**

- **Identidade de usuário real** (contas, login por usuário) — hoje a autenticação é senha única compartilhada, sem conceito de "usuário". É pré-requisito para `user_id` fazer sentido, mas segue como item à parte, já listado em "ainda não decidido" (seção 25 do doc de visão) e no checklist da Fase 8.
- **Caches em memória** (`vault-real.ts`, `grafo.ts`, hoje globais por processo) — se sobreviverem até a Fase 2, precisam virar por-usuário. Fica registrado como implicação a lembrar, não resolvida agora.

---

## Fase 1 — concluída

Todos os pontos do checklist estão fechados (Decisões 1–7). Nenhuma migração estrutural foi realizada — este documento é só o desenho conceitual que orienta a Fase 2 (Knowledge Core), conforme a regra da seção 22 do doc de visão ("nenhuma migração estrutural deverá ocorrer antes desta etapa").
- **Responsabilidades do agente** — tabela de operação → nível de risco → autonomia (seção 16 do doc de visão).
- **Papel futuro do Obsidian** — integração ativa vs. apenas formato de exportação.
- **Arquitetura multiusuário** — revisão do modelo acima sob isolamento entre usuários.
