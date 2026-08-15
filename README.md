# Personal Brain

Um chat que conversa com as minhas notas do Obsidian.

## Onde o projeto está agora

**Etapa 3 (+ grafo e leitura de notas) — vault real, ainda sem IA.** A árvore
de pastas da esquerda vem do seu repositório do Obsidian no GitHub de
verdade. O agente do chat continua respondendo sempre a mesma mensagem —
isso é a próxima etapa.

O que já dá para fazer na tela:

- navegar pela árvore de pastas e notas reais do seu vault (abre e fecha)
- um grafo animado atrás do chat, com uma bolinha por nota e uma linha para
  cada link `[[assim]]` entre elas — ele "respira" sempre, e dá um pulso a
  cada resposta do agente
- clicar numa nota (na barra lateral ou numa bolinha do grafo) abre um
  painel com o conteúdo dela em Markdown; um botão nesse painel preenche
  uma pergunta sobre a nota no campo do chat
- mandar mensagens e ver o histórico da conversa

## Configurar

Copie `.env.local.example` para `.env.local` e preencha:

- `VAULT_REPO` — o repositório do seu vault, formato `dono/repositorio`
- `GITHUB_TOKEN` — um Personal Access Token com permissão de leitura nesse repo
- `VAULT_BRANCH` e `VAULT_SUBPATH` — opcionais, veja o arquivo de exemplo

Sem essas variáveis, a página mostra uma tela explicando o que falta em vez
de quebrar.

## Rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:3000.

## Mapa dos arquivos

| Arquivo | O que faz |
| --- | --- |
| [src/app/page.tsx](src/app/page.tsx) | Roda no servidor: busca a árvore e o grafo do vault, e decide entre a tela normal ou a de configuração. |
| [src/app/api/notas/[...caminho]/route.ts](src/app/api/notas/[...caminho]/route.ts) | Rota que devolve o conteúdo de uma nota, para o painel de leitura buscar sob demanda. |
| [src/components/PaginaPrincipal.tsx](src/components/PaginaPrincipal.tsx) | Monta a tela interativa: cabeçalho, barra lateral, grafo de fundo, chat e o painel de leitura. Guarda o estado compartilhado entre eles. |
| [src/components/ConfiguracaoNecessaria.tsx](src/components/ConfiguracaoNecessaria.tsx) | Tela mostrada quando o vault não pôde ser carregado. |
| [src/components/BarraLateral.tsx](src/components/BarraLateral.tsx) | A árvore de pastas e notas. Se desenha recursivamente. |
| [src/components/GrafoDeFundo.tsx](src/components/GrafoDeFundo.tsx) | O grafo animado em canvas: física do `d3-force` + uma "respiração" e um pulso desenhados por cima. |
| [src/components/LeitorDeNota.tsx](src/components/LeitorDeNota.tsx) | Painel flutuante com o conteúdo de uma nota, em Markdown. |
| [src/components/Chat.tsx](src/components/Chat.tsx) | Lista de mensagens, campo de texto e a resposta falsa de agora. |
| [src/components/Mensagem.tsx](src/components/Mensagem.tsx) | Uma bolha de mensagem. A do agente é renderizada como Markdown. |
| [src/lib/types.ts](src/lib/types.ts) | Os tipos compartilhados (mensagem, item do vault). |
| [src/lib/github.ts](src/lib/github.ts) | Fala com a API REST do GitHub — árvore de arquivos e leitura de blob. |
| [src/lib/vault-real.ts](src/lib/vault-real.ts) | Transforma a árvore do GitHub em pastas/notas, lê o conteúdo de uma nota e mantém um cache curto. |
| [src/lib/grafo.ts](src/lib/grafo.ts) | Baixa o conteúdo de todas as notas, acha os links `[[assim]]` e monta o grafo. |
| [src/app/globals.css](src/app/globals.css) | A paleta de cores, em variáveis CSS. Modo claro e escuro. |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4

## Próximas etapas

4. Ligar o Gemini com function calling, para ele buscar e ler as notas sozinho.
5. Deixar o agente criar e editar notas (cada escrita vira um commit no vault).

> A pasta `etapas-futuras/` guarda um rascunho do backend das etapas 4 e 5
> (busca, leitura de conteúdo, criação/edição de notas). Ela está fora do
> build (veja `tsconfig.json`) e não roda em nada por enquanto.
