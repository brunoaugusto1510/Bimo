# DESIGN.md — Bimo

Design system do Bimo, **derivado do que já existe**, não reinventado:

- **Base de design:** artifact [Bimo — Design System](https://claude.ai/artifact/BZGehoJQFuhgXiS9M61zfJ) (`project/README.md` + `project/tokens.json`).
- **Implementação:** `src/app/globals.css` (único lugar onde valores vivem) + a seção "Design system" do `CLAUDE.md`.
- **Este arquivo** consolida os dois, diz o porquê de cada decisão e lista onde o app e o DS divergem. Os tokens em formato máquina estão em [`design-tokens.json`](design-tokens.json); a prévia visual, em [`design-preview.html`](design-preview.html).

> Regra de ouro: quando o DS mudar, reler `tokens.json` e atualizar **só** o `globals.css`. Este arquivo e o JSON acompanham.

## 1. Princípios

| Princípio | Decisão | Por quê |
|---|---|---|
| Calmo e claro | Fundo quente (`#fbfaf8`), cantos arredondados, sem sombras | O Bimo é um espaço de leitura e pensamento; a interface não pode competir com as notas. |
| Azul = ação ou voz do Bimo | `destaque` é a **única** cor de ação | Se tudo é azul, nada é; reservar o azul faz seleção, link e "Bimo falando" lerem na hora. |
| Bordas, não sombras | Contorno de 1px em `borda`; só existe `shadow-foco` | Separação por superfície/borda fica estável nos dois temas; sombra some no escuro. |
| O grafo é o cérebro | Nós e arestas no lugar de spinners (`BimoPensando`) | Pensar, buscar e ligar notas têm a mesma linguagem visual da marca. |
| Sistema antes de estilo | Nenhuma cor literal em componente | Trocar o visual (ou o tema) é editar um arquivo. |

## 2. Cor

### Tokens semânticos

Nomes do app em pt-BR; o nome equivalente no DS está na coluna "DS". "— (app)" = o DS não define (acrescentado aqui).

| Token (CSS / Tailwind) | DS | Claro | Escuro | Uso |
|---|---|---|---|---|
| `--fundo` · `bg-fundo` | bg | `#fbfaf8` | `#161513` | Fundo de tela |
| `--painel` · `bg-painel` | superficie | `#ffffff` | `#23221e` | Cards, editor, painéis, bolha do agente |
| `--painel-alt` · `bg-painel-alt` | superficie-alt | `#f4f2ec` | `#1c1b18` | Barra lateral, listas, tag |
| `--borda` · `border-borda` | borda | `#e7e3d9` | `#34312b` | Contornos 1px, arestas do grafo |
| `--texto` · `text-texto` | texto | `#23252b` | `#ecebe6` | Texto principal |
| `--texto-suave` · `text-suave` | texto-suave | `#8b8f94` | `#9c9890` | Meta, datas, itens inativos |
| `--destaque` · `bg-destaque` | azul | `#2574e0` | `#2574e0` | Ação primária, seleção, nó em foco |
| `--destaque-hover` | azul-hover | `#1e66c4` | `#1e66c4` | Hover de ação |
| `--sobre-destaque` | — (app) | `#ffffff` | `#ffffff` | Texto sobre `destaque` |
| `--destaque-texto` · `text-destaque-texto` | — (app) | `#2574e0` | `#6ea8f2` | Azul como **texto**: links, título de nota, item selecionado |
| `--destaque-suave` | azul-suave | `#e8f1fc` | `#16263b` | Sugestões do Bimo |
| `--destaque-suave-borda` | azul-suave-borda | `#cfe0f8` | `#24405f` | Contorno da sugestão |
| `--desabilitado` / `-texto` | — (app) | `#eceae4` / `#b3b0a8` | `#2a2824` / `#6b675f` | Botão desabilitado |
| `--erro` / `--erro-suave` | — (app) | `#c53030` / `#fbeaea` | `#ff8080` / `#3a1f1f` | Erros |
| `--bolha-usuario` / `-texto` | — (app) | `#2574e0` / `#fff` | igual | Bolha de quem digita |
| `--bolha-agente` | superficie | `#ffffff` | `#23221e` | Bolha do Bimo |
| `--no-neutro` / `--aresta-neutra` | — (app) | `#c9c6bd` / `#d8d4c9` | `#5a564e` / `#46423b` | BimoThinking neutro |

**Por que `destaque-texto` existe separado de `destaque`:** o azul de ação (`#2574e0`) serve de fundo (branco em cima: 4.51:1), mas como texto sobre o fundo escuro precisa ser clareado (`#6ea8f2`). Dois tokens deixam cada papel ajustar-se sozinho por tema.

### Paleta categórica do grafo (fora do DS, de propósito)

8 cores por grupo de pasta, ordem fixa, validadas para daltonismo (claro e escuro) + `--grafo-tag` para nós de tag. O DS só pede "nós neutros e poucos em azul"; a paleta categórica nasceu da necessidade de distinguir pastas e **não deve ser substituída** pelo azul/teal do DS.

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | tag |
|---|---|---|---|---|---|---|---|---|---|
| Claro | `#2a78d6` | `#eb6834` | `#1baf7a` | `#eda100` | `#e87ba4` | `#008300` | `#4a3aa7` | `#e34948` | `#5f8f8b` |
| Escuro | `#3987e5` | `#d95926` | `#199e70` | `#c98500` | `#d55181` | `#008300` | `#9085e9` | `#e66767` | `#7fb3ae` |

### Não adotado do DS

- `teal` (`#3fd1be`): só pintava iniciais de avatar sem foto; o app não tem avatares.

### Contraste medido (WCAG 2.x)

| Par | Claro | Escuro |
|---|---|---|
| `texto` / `fundo` | 14.68 | 15.29 |
| `texto` / `painel` | 15.32 | 13.34 |
| `texto-suave` / `fundo` | **3.12** | 6.35 |
| `texto-suave` / `painel-alt` | **2.91** | 5.99 |
| `destaque-texto` / `fundo` | **4.33** | 7.43 |
| `destaque-texto` / `destaque-suave` | **3.96** | 6.22 |
| branco / `destaque` | 4.51 | 4.51 |
| branco / `destaque-hover` | 5.60 | 5.60 |
| `erro` / `fundo` | 5.24 | 7.52 |
| `desabilitado-texto` / `desabilitado` | 1.80 | 2.61 (intencional: desabilitado) |

Em negrito, o que fica abaixo de 4.5:1 no tema claro. `texto-suave` está assim **por decisão do DS** ("só metadado e item inativo, nunca texto essencial"). O tema escuro, derivado aqui, passa em tudo.

## 3. Tipografia

Uma família só: pilha do sistema (`--fonte`), sem arquivos de fonte (rápido e sem FOUT). Mono (`--font-geist-mono`) só para `code`.

| Token (Tailwind) | Tamanho / altura | Peso | Cor | Uso |
|---|---|---|---|---|
| `text-titulo-nota` | 26px / 1.25 | 600 | `destaque-texto` | Título da nota aberta |
| `text-corpo` | 15px / 1.6 | 400 | `texto` | Corpo de nota |
| `text-meta` | 12.5px / 1.4 | 400 | `texto-suave` | Legendas, "7 conexões · editada em março" |
| `text-secao` | 11px / 1.4 | 600, `uppercase`, `tracking-[0.08em]` | `texto-suave` | Rótulo de seção |
| `text-controle` _(app, fora do DS)_ | 13.5px / 1.5 | 600 em botões e pílulas | `texto` | Botões, pílulas, campo de busca, itens da árvore |
| _tag_ (sem token) | 12px | 400 | `destaque-texto` | `#leitura` — ainda sem componente |
| _numero_ (sem token) | 30px | 700 | `texto` | Stat — ainda sem componente |

Texto em sentença (não Title Case), pt-BR, "você". Ações são verbos: "Abrir Nota", "Ver vizinhos". Meta separada por `·`.

## 4. Forma e espaço

| Raio | Valor | Onde |
|---|---|---|
| `rounded-tag` | 6px | Tag |
| `rounded-bloco` | 10px | Botão-bloco de formulário |
| `rounded-card` | 12px | Cards de nota, sugestões, campo de busca |
| `rounded-painel` | 14px | Headers, painéis, leitor |
| `rounded-bolha` | 16px | Bolhas de chat (canto de quem fala em 4px: `rounded-*-sm`) |
| `rounded-full` | pill | Botões, chips, seletores, switches |

Espaço: escala do Tailwind (múltiplos de 4). Nomes do DS: `espaco-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-6` 24 · `-8` 32. Card com padding 16, blocos separados por 24, margem de página 32.

**Alvos de toque ≥ 40px** (`h-10`/`min-h-10`; se o visual for menor, estender com `after:-inset-*`).

**Sombra:** só `shadow-foco` (`0 8px 24px rgba(0,0,0,.06)`) no cartão sobre o grafo. Não adicionar outras.

## 5. Movimento

- **Entrada:** `motion-safe:animate-entrada` — 200ms, `cubic-bezier(0.16, 1, 0.3, 1)`, sobe 4px com fade. Só entrada; saída é seca.
- **Pressionar:** `motion-safe:active:scale-[0.96]` com `transition-[…]` explícita. Nunca `transition-all`.
- **BimoPensando:** loop de 2.4s (arestas se desenham, pulso azul passa de nó em nó). Só quando o agente pensa/busca/sugere. Com `prefers-reduced-motion` fica estático, nó central azul.
- `tabular-nums` em todo número que muda; `text-balance` em títulos curtos, `text-pretty` em textos curtos.

## 6. Temas

Claro é o do DS; escuro é derivado no app. O atributo `data-tema` do `<html>` é **sempre** escrito por JS (`src/lib/tema.ts`, e um script inline no `<head>` antes do primeiro paint), a partir de `localStorage["bimo_tema"]` (`sistema` | `claro` | `escuro`). O CSS tem um único bloco `:root[data-tema="escuro"]`, sem `@media (prefers-color-scheme)`. Quem lê cor fora do CSS (o canvas do grafo) precisa reler quando `data-tema` mudar.

## 7. Marca

`MarcaBimo` renderiza o grafo em forma de cérebro (`src/assets/bimo-marca.svg` a partir de 48px, `bimo-marca-pequena.svg` de 16 a 40px). Usar como está, sobre fundo claro, nunca recolorir. "Bimo fala" = marca do cérebro, não emoji. Não há biblioteca de ícones.

## 8. Auditoria rápida (estado atual do código)

Resumo contra o código em `src/`. Nota por dimensão e exemplo concreto.

| Dimensão | Nota | Observação |
|---|---|---|
| Consistência de cor | 10 | Zero cor literal em componentes; os únicos hex fora do `globals.css` são os SVGs da marca (intencional: "usar como está"). |
| Hierarquia tipográfica | 9 | Tamanhos de controle (13/13.5px) unificados em `text-controle`. Restam `text-[10px]` no chevron (`BarraLateral.tsx`, glifo, não texto) e `text-sm` (14px) em `Mensagem.tsx` e na linha de pasta. |
| Ritmo de espaçamento | 9 | Só escala Tailwind; exceções pontuais (`py-2.5`, `md:px-[18px] md:py-[7px]` em `SeletorPill.tsx:39`). |
| Consistência de componente | 9 | Itens da árvore agora usam `rounded-tag` (6px, o mesmo valor do antigo `rounded-md`). Botões em pill seguem o DS. |
| Responsivo | 9 | Mobile-first, `md:` para desktop, alvos ≥ 40px. |
| Modo escuro | 9 | Completo, tokens por tema, canvas do grafo reage a `data-tema`. |
| Animação | 10 | Curta, com propósito, tudo sob `motion-safe`. |
| Acessibilidade | 7 | Contrastes abaixo de 4.5:1 no claro (tabela acima); 3 cores do grafo claro com < 3:1 contra o fundo (`#1baf7a` 2.70, `#eda100` 2.08, `#e87ba4` 2.58) — são marcas gráficas, mas o âmbar fica bem abaixo do mínimo de 3:1 para elementos não textuais. |
| Densidade de informação | 9 | Grafo discreto ao fundo, um painel por vez no mobile. |
| Acabamento | 9 | Press feedback, estados vazios/erro, `BimoPensando` no lugar de spinner. |

Notas de responsivo, escuro, animação, densidade e acabamento vêm da leitura do `CLAUDE.md` e do `globals.css`, não de teste em navegador; só cor, tipografia, componentes e contraste foram verificados no código.

### Slop check

Limpo: sem gradientes, sem glassmorphism, sem sombra decorativa, sem azul-para-roxo, animação só de entrada, fonte do sistema por escolha. Pendência de marca: o intro `.mp4` e os `.png` do logo ainda estão no roxo antigo (já registrado no `CLAUDE.md`).

## 9. Lacunas e próximos passos (por ordem de retorno)

1. ~~Tokenizar os tamanhos fora da escala~~ — **feito**: `--text-controle` (13.5px); os botões do cartão de foco e o `BimoPensando` subiram de 13px para 13.5px.
2. **Decidir o âmbar do grafo claro** (`--grafo-cor-4`, 2.08:1): escurecer (mantendo o matiz) ou aceitar como exceção documentada.
3. ~~Corrigir o `CLAUDE.md`/`AGENTS.md`~~ — **feito**: "Styling convention" agora aponta para `:root[data-tema="escuro"]`.
4. **Componentes do DS sem equivalente no app:** tag badge (12px/azul/`rounded-tag`), stat tile (30px/700), tab bar, avatar. Criar só quando a tela existir (YAGNI).
5. ~~Raio `rounded-md` na `BarraLateral`~~ — **feito**: `rounded-tag` nas duas linhas da árvore (mesmo valor, 6px).

Pendentes: 2 e 4.
