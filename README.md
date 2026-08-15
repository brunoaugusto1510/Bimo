# Personal Brain

Um chat que conversa com as minhas notas do Obsidian.

## Onde o projeto está agora

**Etapa 2 — interface básica.** Ainda **não existe IA** e ainda **não existe
conexão com o vault de verdade**: a árvore de pastas da esquerda é um exemplo
fixo, e o agente responde sempre a mesma mensagem.

O que já dá para fazer na tela:

- navegar pela árvore de pastas (abre e fecha)
- clicar numa nota — isso já escreve uma pergunta sobre ela no campo do chat
- mandar mensagens e ver o histórico da conversa

## Rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:3000.

## Mapa dos arquivos

| Arquivo | O que faz |
| --- | --- |
| [src/app/page.tsx](src/app/page.tsx) | Monta a tela: cabeçalho, barra lateral e chat. Guarda o estado que os dois painéis compartilham. |
| [src/components/BarraLateral.tsx](src/components/BarraLateral.tsx) | A árvore de pastas e notas. Se desenha recursivamente. |
| [src/components/Chat.tsx](src/components/Chat.tsx) | Lista de mensagens, campo de texto e a resposta falsa de agora. |
| [src/components/Mensagem.tsx](src/components/Mensagem.tsx) | Uma bolha de mensagem. A do agente é renderizada como Markdown. |
| [src/lib/types.ts](src/lib/types.ts) | Os tipos compartilhados (mensagem, item do vault). |
| [src/lib/vault-exemplo.ts](src/lib/vault-exemplo.ts) | O vault de mentira que alimenta a barra lateral. |
| [src/app/globals.css](src/app/globals.css) | A paleta de cores, em variáveis CSS. Modo claro e escuro. |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4

## Próximas etapas

3. Ler o vault de verdade — conectar no repositório do Obsidian pela API do GitHub.
4. Ligar o Gemini com function calling, para ele buscar e ler as notas sozinho.
5. Deixar o agente criar e editar notas (cada escrita vira um commit no vault).

> A pasta `etapas-futuras/` guarda um rascunho do backend das etapas 3 a 5.
> Ela está fora do build (veja `tsconfig.json`) e não roda em nada por enquanto.
