# Personal Brain

Um chat que conversa com as minhas notas do Obsidian.

## Onde o projeto está agora

**Etapa 3 — vault real, ainda sem IA.** A árvore de pastas da esquerda agora
vem do seu repositório do Obsidian no GitHub de verdade. O agente do chat
continua respondendo sempre a mesma mensagem — isso é a próxima etapa.

O que já dá para fazer na tela:

- navegar pela árvore de pastas e notas reais do seu vault (abre e fecha)
- clicar numa nota — isso já escreve uma pergunta sobre ela no campo do chat
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
| [src/app/page.tsx](src/app/page.tsx) | Roda no servidor: busca a árvore do vault e decide entre mostrar a tela normal ou a de configuração. |
| [src/components/PaginaPrincipal.tsx](src/components/PaginaPrincipal.tsx) | Monta a tela interativa: cabeçalho, barra lateral e chat. Guarda o estado que os dois painéis compartilham. |
| [src/components/ConfiguracaoNecessaria.tsx](src/components/ConfiguracaoNecessaria.tsx) | Tela mostrada quando o vault não pôde ser carregado. |
| [src/components/BarraLateral.tsx](src/components/BarraLateral.tsx) | A árvore de pastas e notas. Se desenha recursivamente. |
| [src/components/Chat.tsx](src/components/Chat.tsx) | Lista de mensagens, campo de texto e a resposta falsa de agora. |
| [src/components/Mensagem.tsx](src/components/Mensagem.tsx) | Uma bolha de mensagem. A do agente é renderizada como Markdown. |
| [src/lib/types.ts](src/lib/types.ts) | Os tipos compartilhados (mensagem, item do vault). |
| [src/lib/github.ts](src/lib/github.ts) | Fala com a API REST do GitHub — só leitura de árvore, por enquanto. |
| [src/lib/vault-real.ts](src/lib/vault-real.ts) | Transforma a árvore do GitHub em pastas/notas e mantém um cache curto. |
| [src/app/globals.css](src/app/globals.css) | A paleta de cores, em variáveis CSS. Modo claro e escuro. |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4

## Próximas etapas

4. Ligar o Gemini com function calling, para ele buscar e ler as notas sozinho.
5. Deixar o agente criar e editar notas (cada escrita vira um commit no vault).

> A pasta `etapas-futuras/` guarda um rascunho do backend das etapas 4 e 5
> (busca, leitura de conteúdo, criação/edição de notas). Ela está fora do
> build (veja `tsconfig.json`) e não roda em nada por enquanto.
