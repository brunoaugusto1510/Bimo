# Handoff: Bimo Mobile — app de notas com grafo de conhecimento e IA

## Visão geral

Bimo é um app mobile de notas do tipo "segundo cérebro": um vault pessoal de notas conectadas como grafo, com uma IA (o próprio Bimo) que percorre o vault, responde em linguagem natural e ajuda a escrever. O app tem dois destinos principais e dois painéis de conta:

| Destino | Onde vive | O que faz |
|---|---|---|
| **Bimo** | seletor central do header | Chat com a IA; respostas trazem notas como cartões de resultado |
| **Nota** | seletor central do header | Grafo do vault em tela cheia + folha com a lista de notas por cima; abre o editor |
| **Editor de nota** | sheet full-screen sobre Nota | Título, tags, corpo, ações de IA e sugestões aceitáveis/descartáveis |
| **Perfil** | sheet, aberto pelo avatar | Nome, e-mail, instruções de tom para a IA, números do vault |
| **Configurações** | sheet, aberto pelo avatar | Sync, grafo de fundo, inteligência, densidade de nós |

**Não existe barra de navegação inferior.** Os dois destinos vivem no `TabSwitcher` centralizado no header; Perfil e Configurações saem de um menu aberto pelo avatar no canto superior direito. Isso foi uma decisão explícita: com o grafo morando dentro de Nota sobraram dois destinos, e uma bottom bar apenas duplicaria o seletor do topo.

## Sobre os arquivos de design

Os arquivos em `design/` são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar estes designs no ambiente do codebase de destino** (React Native, Flutter, SwiftUI, Kotlin/Compose, web…) usando os padrões e bibliotecas já estabelecidos lá. Se ainda não existe um ambiente, escolha o framework mais adequado ao projeto e implemente os designs nele.

O protótipo usa um runtime próprio de componentes (`support.js`) que **não deve ser portado**. O que importa é: layout, tokens, comportamento e conteúdo, todos documentados abaixo.

## Fidelidade

**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios, sombras e transições são finais e vêm do Bimo Design System (tokens em `design/tokens/`). Recrie a UI fielmente usando as bibliotecas do codebase. O único elemento intencionalmente aproximado é o campo de grafo: os dados são de exemplo, a estética (tamanhos, cores, densidade, comportamento de rótulo) é final.

O frame de iPhone em volta das telas é apenas moldura de apresentação — **não** faz parte do app.

## Telas

Todas as telas assumem uma viewport de **402 × 874 px** (iPhone 16 Pro em pontos CSS), com **54 px** de status bar no topo e **34 px** de home indicator embaixo. A coluna é única; tudo é alcançável com o polegar.

---

### 1. Header (persistente em Bimo e Nota)

- **Altura:** 56 px, `flex-shrink: 0`, fixo.
- **Fundo:** `var(--glass-bar)` (surface a 90%) + `backdrop-filter: blur(12px)`.
- **Borda inferior:** 1 px `var(--hairline)`.
- **Padding:** `0 12px`; itens em flex, `gap: 8px`, `align-items: center`.
- **Conteúdo, da esquerda para a direita:**
  1. Marca: ícone Material Symbols `psychology`, 22 px, `var(--primary)`, com eixo `FILL: 1`.
  2. `TabSwitcher` centralizado (`flex: 1`, `justify-content: center`, `min-width: 0`): pill de 2 opções, "Bimo" e "Nota". Container `var(--surface-container-low)`, borda 1 px `var(--hairline)`, `border-radius: 9999px`, padding 4 px. Item ativo: fundo `var(--primary)`, texto `var(--on-primary)`, peso 600. Inativo: texto `var(--on-surface-variant)`, peso 500. Fonte 13/18 px.
  3. Avatar, 32 px, circular. Sem foto, mostra iniciais ("MA") sobre `var(--secondary-container)` com texto `var(--on-secondary-container)`, borda 1 px `var(--hairline)`. É botão: abre o menu de conta.

### 2. Bimo (chat)

Fundo: campo de grafo ambiente (ver seção "Campo de grafo", modo ambiente).

- **Coluna de mensagens:** `flex: 1`, scroll vertical, `padding: 16px 16px 8px`, flex column, `gap: 16px`.
- **Bolha do agente:** alinhada à esquerda, `max-width: 85%`, largura 100% da coluna. Fundo `var(--glass-bubble)` (surface 60%) + blur 12 px, borda 1 px `var(--hairline)`, texto `var(--on-surface)`, padding 12 px, `border-radius: 12px` com o canto **inferior esquerdo em 6 px** (a "cauda"), `box-shadow: var(--shadow-sm)`, fonte 14 px / line-height 1.625.
- **Bolha do usuário:** alinhada à direita, `max-width: 85%`. Fundo `var(--bubble-user)` (primary a 90%), borda 1 px `var(--bubble-user-border)`, texto `var(--on-primary)`, cauda no canto **inferior direito** (6 px).
- **Metadados:** abaixo da bolha, 12/16 px, `var(--text-faint)`, formato `Bimo AI · 09:41` (separador é o ponto médio `·`). Margem superior 4 px; 4 px de recuo lateral no lado da cauda.
- **Cartão de resultado** (dentro da bolha do agente, `margin-top: 12px`, coluna com `gap: 8px`): fundo `var(--glass-card)` (surface-container-low 80%) + blur 4 px, borda 1 px `var(--hairline)`, raio 8 px, padding 12 px. Título 14/20 px peso 600 em `var(--primary)` com ícone `description` de 16 px; snippet 12/16 px `var(--text-muted)`, cortado em 2 linhas. **No hover muda apenas a cor da borda, para `var(--primary)`** — nada de elevação ou escala.
- **Indicador de digitação:** três círculos de 6 px, `var(--outline)`, dentro de uma bolha de agente; bounce escalonado em 0 / 0.2 / 0.4 s.
- **Composer (`GlassInputDock`):** fixo no rodapé da coluna, dentro de uma faixa `padding: 8px 16px 12px` com fundo `var(--dock-protection)` (gradiente background→transparente, `pointer-events: none`; só o dock é interativo). O dock: fundo `var(--glass-dock)` (surface 60%) + blur 16 px, borda 1 px `var(--hairline)`, raio 16 px, padding 4 px, `box-shadow: var(--shadow-xl)`. Dentro: textarea auto-expansível (altura inicial 46 px, máximo 160 px, padding 12 px, `box-sizing: border-box`), e abaixo uma linha com dois ícones à esquerda (`attach_file`, `center_focus_strong`, 20 px, `var(--outline)`) e o botão enviar à direita (32 × 32 px, fundo `var(--primary)`, raio 8 px, ícone `arrow_upward` 18 px em `var(--on-primary)`).
- **Foco:** borda passa a `var(--primary)` + `box-shadow: var(--shadow-xl), var(--ring-focus-soft)`.
- **Placeholder:** `Pergunte ao Bimo ou consulte seu vault...` (ellipsis com três pontos literais).
- **Enter envia; Shift+Enter quebra linha.**

**Comportamento:** enviar adiciona a bolha do usuário, mostra o indicador de digitação, dispara uma rajada de partículas no grafo e, após ~1,6 s, insere a resposta do agente com cartões. Tocar num cartão abre o editor daquela nota.

### 3. Nota (grafo + lista)

O grafo em modo interativo ocupa **toda a área de conteúdo** (abaixo do header, acima do home indicator); a lista de notas vem numa folha por cima.

- **Chips de contexto:** `position: absolute; top: 12px; left/right: 16px`, `pointer-events: none`. Dois pills 11/14 px em `var(--outline)`, fundo `var(--glass-bar)` + blur 12 px, borda 1 px `var(--hairline)`, raio 9999 px, padding `4px 9px`. Esquerda: escopo (`vault inteiro` ou `vizinhança de 'Título'`). Direita: contagem (`642 nós` ou `3 conexões`).
- **Folha de notas:** ancorada ao rodapé, largura total, `border-radius: 16px 16px 0 0`, fundo `var(--glass-sheet)` (surface 85%) + blur 16 px, borda 1 px `var(--hairline)` sem borda inferior, `box-shadow: var(--shadow-xl)`. **Altura em três passos: 34% → 58% → 80%** da área de conteúdo, com `transition: height 300ms cubic-bezier(0.2,0,0,1)`. Padrão: 58%.
  - **Alça:** botão de largura total, altura mínima 24 px, padding `8px 0 4px`, com uma barra de 36 × 4 px em `var(--outline)` a 45% de opacidade. Tocar avança o passo, ciclicamente. (Numa implementação nativa, use um bottom sheet arrastável com esses três snap points; o tap na alça deve continuar funcionando.)
  - **Busca:** `SearchField` pill, padding lateral 16 px, `box-sizing: border-box` (o campo tem padding próprio de `6px 8px 6px 30px`; sem border-box ele vaza da folha). Fundo `var(--surface-container-low)`, borda 1 px `var(--hairline)`, raio full, ícone `search` 18 px em `var(--outline)` a 8 px da esquerda. Foco: borda `var(--primary)` + `var(--ring-focus)`. Placeholder `Buscar no vault...`. Filtra por título e por snippet.
  - **Eyebrow:** `NOTAS RECENTES` (ou `NOTAS CONECTADAS` quando há nó selecionado), 12/16 px peso 500, `text-transform: uppercase`, `letter-spacing: .08em`, `var(--outline)`. Quando há seleção, à direita aparece um botão de texto `limpar` com ícone `close` 14 px em `var(--primary)`.
  - **Cartões de nota:** coluna com `gap: 8px`, padding lateral 12 px. Cada cartão é um botão: padding 12 px, raio 8 px, fundo `var(--glass-card)` + blur 4 px, borda 1 px `var(--hairline)` — **`var(--primary)` quando é o nó selecionado**. Linha 1: título 14/20 px peso 600 `var(--primary)` (elipse em overflow) e, à direita, contagem de conexões com ícone `hub` 14 px em 12/16 px `var(--outline)`. Linha 2: snippet 12/16 px `var(--text-muted)`, cortado em 2 linhas. Linha 3: pasta num chip mono de 11 px (`var(--font-mono)`, fundo `var(--surface-chip)`, raio 4 px, padding `2px 6px`) e a data à direita em 12/16 px `var(--outline)`.
  - **Ações no rodapé da folha:** padding `0 12px 12px`, `gap: 8px`. Botão primário (`flex: 1`, altura mínima 44 px, raio 12 px, fundo `var(--primary)`, texto `var(--on-primary)` 14/20 px peso 600, `box-shadow: var(--shadow-sm)`): `+ Nova Nota` sem seleção, `Abrir Nota` (ícone `description`) com nó selecionado. Com seleção, aparece ao lado um botão outline `Perguntar` (ícone `forum` 18 px, borda 1 px `var(--hairline)`, fundo transparente) que leva ao chat com a pergunta já preenchida.

**Comportamento:** arrastar dá pan no grafo; scroll/pinch dá zoom (0,6× a 2,4×). Tocar num nó o seleciona: os chips mudam para a vizinhança, a lista passa a mostrar só o nó e seus vizinhos, e a folha sobe ao menos ao passo 1. Tocar fora dos nós limpa a seleção. Tocar num cartão seleciona o nó correspondente (grafo e lista ficam sempre sincronizados).

### 4. Editor de nota (sheet sobre Nota)

Sheet full-screen: `var(--glass-sheet)` + blur 16 px, `box-shadow: var(--shadow-xl)`, respeitando as áreas seguras de 54/34 px.

- **Barra própria:** altura mínima 56 px, fundo `surface` a 95%, borda inferior 1 px `var(--hairline)`. Esquerda: `arrow_back` 22 px (36 × 36 px). Centro: nome da pasta, 14/20 px peso 600 `var(--on-surface-variant)`, com elipse. Direita: botão pill **Bimo** (`psychology` 18 px + rótulo 12/16 px peso 500 em `var(--primary)`, borda 1 px `var(--hairline)`, fundo `var(--surface-container-low)`, raio full, altura mínima 36 px) e um icon button `close` de 18 px.
- **Corpo** (scroll, padding 20 px):
  - Título: input sem borda, 24/32 px peso 600, `letter-spacing: -0.02em`, `var(--primary)`, borda inferior 1 px `var(--hairline)`, `padding-bottom: 8px`, `margin-bottom: 12px`.
  - Tags: chips mono de 11 px (mesmo estilo do cartão), flex-wrap, `gap: 8px`, `margin-bottom: 20px`.
  - Texto: textarea sem borda, altura mínima 240 px, 14 px / line-height 1.625, `var(--on-surface)`, sem resize.
  - Rodapé de status: `margin-top: 24px`, borda superior 1 px `var(--hairline)`, ícone `hub` 16 px + texto 12/16 px `var(--outline)`: `O grafo acompanha o que você escreve` ou `N nós novos acenderam no grafo`.
- **Cartão de sugestão da IA:** `margin-top: 16px`, padding 12 px, **borda 1 px tracejada `var(--primary)`**, raio 8 px, fundo primary-fixed a 55%, entra com fade+4 px em 200 ms. Cabeçalho: `psychology` 16 px `var(--primary)` + rótulo 12/16 px peso 500 em `var(--on-primary-fixed-variant)`, formato `Sugestão do Bimo · Sugerir links`. Corpo: 14 px / 1.625. Para a ação de tags, os chips propostos aparecem em tom primary. Ações: botão primário `Inserir` (ícone `add`) e botão ghost `Descartar`.
- **Menu de ações da IA:** bottom sheet sobre o editor, com backdrop `rgba(27,27,29,.18)`. Painel: margem `0 12px 46px`, padding 8 px, raio 16 px, `var(--glass-sheet)` + blur 16 px, borda 1 px `var(--hairline)`, `box-shadow: var(--shadow-xl)`, entrada slide-up de 300 ms. Eyebrow `BIMO NESTA NOTA`. Cinco linhas, cada uma altura mínima 44 px, padding `8px 12px`, raio 8 px, ícone 20 px `var(--primary)` + rótulo 14/22 px:
  1. `Sugerir links` (`hub`)
  2. `Resumir a nota` (`description`)
  3. `Extrair tags` (`sell`)
  4. `Continuar escrevendo` (`edit`)
  5. `Perguntar sobre a nota` (`forum`)

**Comportamento:** cada ação fecha o menu, dispara partículas no grafo e mostra o cartão de sugestão correspondente. `Inserir` anexa o texto ao corpo (ou mescla as tags, sem duplicar) e acende um nó novo no grafo; `Descartar` só fecha o cartão. Digitar no corpo acende um nó novo a cada ~18 caracteres.

### 5. Menu de conta (a partir do avatar)

Bottom sheet com backdrop `rgba(27,27,29,.18)`; mesmo painel do menu de IA. Cabeçalho: avatar de 40 px + nome (14/20 px peso 600) e e-mail (12/16 px `var(--text-muted)`). Três linhas de 44 px, ícone 20 px `var(--outline)`: `Perfil` (`person`), `Configurações` (`settings`), `Sair da conta` (`logout`). Tocar no backdrop fecha.

### 6. Perfil (sheet)

Barra com `arrow_back` + título `Perfil` (16/24 px peso 600). Corpo com padding 20 px:

- Avatar de 64 px + botão outline `Trocar Foto` (ícone `person`) e a legenda `Sem foto: iniciais em Teal Current.` (12/16 px `var(--outline)`).
- Três cartões de estatística lado a lado (`gap: 8px`, `flex: 1`): padding 12 px, borda 1 px `var(--hairline)`, raio 8 px, `var(--glass-card)` + blur 4 px. Valor 24/32 px peso 600 `letter-spacing: -0.02em`; rótulo 12/16 px `var(--text-muted)`. Conteúdo: `642 / Notas`, `1.284 / Conexões`, `12 / Pastas`.
- Campos: label 12/16 px peso 500 `var(--outline)`; input padding `10px 12px`, borda 1 px `var(--hairline)`, raio 8 px, fundo `var(--surface-container-low)`, 14/22 px. Ordem: **Nome**, **E-mail**, **Como o Bimo deve te tratar** (textarea de altura mínima 88 px).
- `Salvar Alterações` como botão primário de largura total; abaixo, separado por borda superior, um botão ghost `Sair da Conta` (`logout`).

### 7. Configurações (sheet)

Barra com `arrow_back` + título `Configurações`. Corpo com padding `16px 20px`:

- **Status de sync** no topo: cartão com ícone `cloud` 20 px em `var(--secondary)`, título `Sincronizado` (14/22 px peso 500), subtítulo `642 notas · há 2 minutos` (12/16 px `var(--text-muted)`) e um icon button `sync` de 18 px à direita.
- **Grupos**, cada um com eyebrow uppercase 12/16 px `letter-spacing: .08em` `var(--outline)` e linhas de altura mínima 44 px, `padding: 8px 0`, separadas por borda inferior 1 px `var(--hairline)`. Cada linha: rótulo 14/22 px + hint 12/16 px `var(--text-muted)` à esquerda, controle à direita.

  1. **GRAFO DE FUNDO** — `Campo do grafo` / "Nós à deriva atrás do conteúdo" (ligado); `Partículas de raciocínio` / "Iris viaja pelas ligações quando o Bimo pensa" (ligado).
  2. **INTELIGÊNCIA** — `Extrair tags ao salvar` / "Sempre como sugestão, nunca automático" (ligado); `Sugerir links enquanto escrevo` / "Mais interrupções, mais conexões" (desligado).
  3. **SINCRONIZAÇÃO** — `Sincronizar só no Wi-Fi` / "Vault local continua disponível offline" (ligado).

- **Switch:** 44 × 26 px, padding 2 px, raio full, borda 1 px `var(--hairline)`. Trilha ligada `var(--primary)`, desligada `var(--surface-container-high)`; knob de 20 px com `var(--shadow-sm)`, branco (`var(--on-primary)`) quando ligado e `var(--outline)` quando desligado; posição por `justify-content`, `transition: background-color 200ms var(--ease-standard)`.
- **Densidade de nós:** linha com três pills mutuamente exclusivos (`70`, `90`, `110`), altura mínima 32 px, padding `6px 10px`, raio full, borda 1 px `var(--hairline)`; o ativo tem fundo `var(--primary)` e texto `var(--on-primary)`. O hint mostra `N nós no campo de fundo`.
- **Rodapé:** ícone `info` 20 px + `Bimo 1.4.0 · vault local com sincronização` (12/16 px `var(--outline)`).

---

## Campo de grafo

Um canvas 2D (referência: `design/graph-field.jsx`), com dois modos.

**Modo ambiente** (fundo do chat): `position: absolute; inset: 0`, `pointer-events: none`, `mix-blend-mode: multiply`, `opacity: 0.8`. Nós à deriva com velocidade ±0,12 px/frame dentro de um raio de `min(w,h) × 0,62` a partir do centro; ao passar de 1,1× esse raio, a velocidade inverte. Contagem no mobile: **70 / 90 / 110** (configurável; padrão 90).

- **Tamanhos dos nós:** 1,1 px na maioria; 2 px em ~8%; 3,2 px em ~2%. Pulsam ±6% de forma contínua.
- **Cores:** `#889299` base, `#a0aab2` claro, `#dcd9dc` esmaecido; ~6% dos nós são "signal" em `#5e4bc0` (Iris). São valores de canvas, não CSS — correspondem aos tokens `--graph-node-*`.
- **Ligações:** linhas de 1 px em `rgba(136,146,153,0.15)`, desenhadas entre nós a menos de 22% do raio, no máximo 6 por nó.
- **Partículas de raciocínio:** quando o Bimo "pensa", 8 partículas Iris de 2,4 px viajam entre nós aleatórios (velocidade 0,012–0,024 do trajeto por frame), com opacidade em pico no meio do caminho.
- **Nós novos:** ao escrever ou aceitar uma sugestão, um nó Iris nasce a 30% do raio, cresce de 0,4× a 1× em ~50 frames e recebe uma partícula partindo de um nó vizinho.

**Modo interativo** (tela Nota): opaco, sem blend mode, `pointer-events: auto`, `touch-action: none`. Além do campo ambiente, desenha os nós nomeados do vault:

- Posições vêm em coordenadas normalizadas (0–1) e são mapeadas para `centro ± raio × 1,05`; cada nó oscila ±3 px na vertical.
- Nó: círculo de `peso × 5,5` px, preenchimento `#fcf8fb`, borda 1 px `#6e7a6f`. Selecionado: preenchimento e borda em Iris, mais um anel pulsante em `rgba(94,75,192,0.35)` a 7 ± 2 px.
- Ligações entre nós nomeados: 1 px em `rgba(94,75,192,0.22)`.
- **Rótulos aparecem só nos nós de peso ≥ 1,2 e no nó selecionado** — decisão deliberada: em 390 px de largura, rotular tudo virava ruído. 12 px peso 500, centralizado, 14 px abaixo do nó, `#3e4a40` (`#1b1b1d` quando selecionado).
- Pan por arraste; zoom por scroll/pinch entre 0,6× e 2,4×; tap com deslocamento menor que 6 px conta como toque no nó (raio de acerto = raio do nó + 10 px). Tap fora de qualquer nó limpa a seleção.

Numa implementação nativa, isto é um canvas/`Skia`/`SpriteKit` com simulação simples — não precisa de motor de física; posições fixas + deriva senoidal bastam.

## Estado

Estado do app, todo local ao componente no protótipo:

| Estado | Tipo | Papel |
|---|---|---|
| `screen` | `'chat' \| 'vault'` | Destino ativo (seletor do header) |
| `messages` | lista | Histórico do chat: `{from: 'user'\|'agent', text, meta?, cards?: noteId[]}` |
| `draft` | string | Texto no composer |
| `typing` | boolean | Indicador de digitação do agente |
| `search` | string | Busca do vault |
| `selectedNode` | noteId \| null | Nó ativo; filtra a lista e destaca no grafo |
| `sheetStep` | 0 \| 1 \| 2 | Altura da folha de notas (34% / 58% / 80%) |
| `editorNote` | noteId \| null | Nota aberta no editor (null = editor fechado) |
| `noteTitle` / `noteText` / `noteTags` | string / string / string[] | Conteúdo em edição |
| `aiMenu` | boolean | Menu de ações da IA aberto |
| `suggestion` | `'links'\|'summary'\|'tags'\|'continue'\|'ask'` \| null | Sugestão pendente |
| `account` | boolean | Menu de conta aberto |
| `sheet` | `'profile'\|'settings'` \| null | Sheet de conta aberta |
| `profile` | objeto | `{name, email, bio}` |
| `toggles` | objeto | `{graph, particles, autoTags, autoLinks, wifi}` |
| `density` | 70 \| 90 \| 110 | Contagem de nós do campo ambiente |
| `pulse` / `grow` | contadores | Disparam rajada de partículas / nascimento de nó |

**Transições relevantes:**

- Enviar mensagem → adiciona bolha, `typing = true`, `pulse++`; após ~1,6 s → resposta com cartões, `typing = false`, `pulse++`.
- Selecionar nó → `selectedNode = id`, `sheetStep = max(1, sheetStep)`.
- Rodar ação de IA → `suggestion = kind`, `aiMenu = false`, `pulse++`.
- Aceitar sugestão → anexa texto ou mescla tags, `suggestion = null`, `grow++`.
- Digitar no corpo → a cada ~18 caracteres, `grow++`.
- `Perguntar` sobre um nó → `screen = 'chat'`, limpa seleção, preenche `draft` com `O que eu já escrevi sobre 'Título'?`.

**Dados que o app real precisa:** notas (`id`, título, pasta, tags, corpo, snippet, editada em, contagem de conexões), arestas do grafo (pares de ids), e um endpoint de IA que aceite a nota como contexto e devolva as cinco ações. No protótipo, tudo é fixture e as respostas da IA são canned.

## Tokens de design

Os arquivos canônicos estão em `design/tokens/` (CSS custom properties, direto do Bimo Design System). Resumo:

**Cores**

| Token | Valor | Uso |
|---|---|---|
| `--primary` | `#5e4bc0` | Electric Iris: ação primária, aba ativa, links, bolha do usuário, nós signal |
| `--on-primary` | `#ffffff` | Texto sobre Iris |
| `--primary-container` | `#9988ff` | Hover de botão primário (texto `#2f1191`) |
| `--primary-fixed` | `#e5deff` | Fundo do cartão de sugestão (a 55%) |
| `--on-primary-fixed-variant` | `#4631a7` | Rótulo do cartão de sugestão |
| `--secondary` | `#4bb6c0` | Teal Current: ações de apoio, ícone de sync |
| `--secondary-container` | `#88f5ff` | Fundo do avatar sem foto (texto `#118691`) |
| `--error` | `#ba1a1a` | Só ações destrutivas e validação |
| `--background` / `--surface` | `#fcf8fb` | Fundo do app |
| `--surface-container-low` | `#f6f3f5` | Cartões, campos, hover de linha |
| `--surface-container-high` | `#eae7ea` | Chips de tag, trilha de switch desligado |
| `--on-surface` | `#1b1b1d` | Texto principal |
| `--on-surface-variant` | `#3e4a40` | Texto secundário |
| `--outline` | `#6e7a6f` | Ícones em repouso, texto esmaecido |
| `--outline-variant` (`--hairline`) | `#bdcabd` | Todas as bordas de 1 px |

Vidros e derivados: `--glass-bar` (surface 90%), `--glass-bubble` / `--glass-dock` (60%), `--glass-sheet` (85%), `--glass-card` (surface-container-low 80%), `--bubble-user` (primary 90%), `--bubble-user-border` (primary 20%), `--dock-protection` (gradiente background→transparente).

Grafo (valores de canvas): `#889299`, `#a0aab2`, `#dcd9dc`, signal `#5e4bc0`, ligação `rgba(136,146,153,0.15)`.

**Tipografia** — Geist para tudo, JetBrains Mono para código e chips de tag. Pesos apenas 400, 500 e 600 (não existe bold).

| Papel | Tamanho / linha | Peso | Tracking |
|---|---|---|---|
| display-md | 24 / 32 | 600 | −0.02em |
| headline-sm | 18 / 26 | 600 | −0.015em |
| title-md | 16 / 24 | 600 | −0.01em |
| title-sm | 14 / 20 | 600 | −0.005em |
| body-base | 14 / 22 | 400 | 0 |
| body-medium | 14 / 22 | 500 | 0 |
| label-sm | 12 / 16 | 500 | 0.01em |
| caption | 12 / 16 | 400 | 0 |
| code-inline | 12 / 18 (mono) | 400 | 0 |

Texto de chat usa `line-height: 1.625` (`--leading-relaxed`).

**Espaçamento** — unidade de 4 px: 4 / 8 / 12 / 16 / 20 / 24. Gutter 16 px. Header 56 px, alvo de toque mínimo 44 px, altura máxima do composer 160 px, largura máxima da coluna de chat 672 px.

**Raios** — 4 px (chips, linhas), 8 px (cartões, botão enviar), 12 px (bolhas, botões primários), 16 px (dock, sheets), full (pills, avatares). Assinatura: bolha de 12 px com **um** canto em 6 px.

**Sombras** — só duas: `--shadow-sm` = `0 1px 2px 0 rgb(27 27 29 / 0.05)` (bolhas, cartões, botões); `--shadow-xl` = `0 20px 25px -5px rgb(27 27 29 / 0.08), 0 8px 10px -6px rgb(27 27 29 / 0.06)` (dock e sheets, só). Sem inner shadow, sem glow.

**Blur** — 4 px (cartões), 12 px (barras, bolhas), 16 px (dock, sheets).

**Movimento** — 150 / 200 / 300 ms com `cubic-bezier(0.2,0,0,1)`. Aplicado a cor, borda, altura da folha e slide-up de sheets. Nada escala ou encolhe no press. Duas exceções com personalidade: o bounce escalonado dos três pontos de digitação (0 / 0.2 / 0.4 s) e a deriva contínua do grafo com suas rajadas de partículas.

**Foco** — borda 1 px Iris + `--ring-focus` (`0 0 0 1px var(--primary)`); no dock, `--ring-focus-soft` (Iris a 20%).

## Assets

- **Ícones:** Material Symbols Outlined, carregados como webfont variável do Google Fonts. É o sistema de ícones inteiro; não há SVG nem PNG. Eixo `FILL: 1` para destinos ativos e ícones de pasta; peso 400. Glifos usados: `psychology`, `description`, `hub`, `search`, `forum`, `settings`, `person`, `logout`, `cloud`, `sync`, `info`, `add`, `edit`, `close`, `arrow_back`, `arrow_upward`, `attach_file`, `center_focus_strong`, `sell`, `open_in_full`, `folder`, `folder_open`.
- **Fontes:** Geist e JetBrains Mono, do Google Fonts (sem binários no pacote).
- **Sem logo, sem ilustração, sem fotografia.** O ícone `psychology` faz o papel de marca. O fundo é o campo de grafo — nunca imagem ou gradiente.
- **Sem emoji, em nenhum lugar.** O único caractere decorativo é o ponto médio `·` de metadados.

## Voz e conteúdo

Bimo é um colega competente que já leu suas notas: abre pelo que encontrou, não por cortesias. Frases completas e declarativas, sem exclamação e sem hedging. A IA diz **eu**; o vault é **seu**. Especificidade é o tom — Bimo cita contagens, datas, pastas e títulos ("3 nós relevantes", "de janeiro", "'Notas atômicas'"), com títulos entre aspas simples na prosa.

Vocabulário: *vault*, *nota*, *nó* (a nota vista do grafo), *tag*, *pasta*, *sync*. Title Case em destinos e botões (`Nova Nota`, `Abrir Nota`); sentence case em placeholders e hints. Eyebrows em maiúsculas com tracking largo. Tags mantêm o `#` e ficam em minúsculas. Mensagens do agente têm uma a três frases, e a evidência vem em cartões.

## Arquivos

Em `design/`:

| Arquivo | O que é |
|---|---|
| `Bimo Mobile (offline).html` | **Comece por aqui.** Protótipo completo, autocontido, abre em qualquer navegador sem internet. Contém o chat, a tela Nota, o editor, Perfil, Configurações e as seis variações exploradas. |
| `Bimo Mobile.dc.html` | Fonte da página de apresentação: um frame por tela + as variações de layout descartadas (úteis como contexto de decisão). |
| `BimoScreen.dc.html` | **O app em si**: todas as telas, estados, handlers e dados de exemplo. É a referência principal de comportamento. |
| `graph-field.jsx` | Campo de grafo em canvas: física da deriva, ligações, partículas, seleção, pan/zoom, regra de rótulo. |
| `ios-frame.jsx` | Só a moldura de apresentação (bezel, status bar). **Não faz parte do app**; não porte. |
| `support.js` | Runtime do protótipo. **Não porte.** |
| `tokens/*.css` | Tokens canônicos do Bimo Design System: cores, tipografia, espaçamento, raios, efeitos, fontes. |

O sistema de design completo (17 componentes React de referência, guidelines e um UI kit navegável) vive no projeto do Bimo Design System, fora deste pacote — vale consultar se você for portar componente por componente.
