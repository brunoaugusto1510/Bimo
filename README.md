# Personal Brain

Um chat que conversa com as minhas notas do Obsidian.

## Onde o projeto está agora

**Agente real, com leitura e escrita no vault, atrás de login.** O chat
conversa com o Gemini de verdade: ele busca, lista e lê suas notas por
function calling antes de responder, e — quando você pedir — cria ou edita
notas, gerando um commit real no repositório. O acesso é protegido por senha
(cookie de sessão assinado, sem banco de dados).

O que já dá para fazer na tela:

- fazer login com senha (`/login`) antes de qualquer outra coisa
- navegar pela árvore de pastas e notas reais do seu vault (abre e fecha)
- um grafo animado atrás do chat, com uma bolinha por nota e uma linha para
  cada link `[[assim]]` entre elas — ele "respira" sempre, e dá um pulso a
  cada resposta do agente
- clicar numa nota (na barra lateral ou numa bolinha do grafo) abre um
  painel com o conteúdo dela em Markdown; um botão nesse painel preenche
  uma pergunta sobre a nota no campo do chat
- perguntar qualquer coisa sobre o vault: o agente busca/lê as notas
  sozinho antes de responder, e mostra embaixo da resposta quais ferramentas
  usou em cada turno
- pedir para criar ou editar uma nota — a resposta mostra um link direto
  para o commit gerado no GitHub

## Configurar

Crie um `.env.local` na raiz com:

- `VAULT_REPO` — o repositório do seu vault, formato `dono/repositorio`
- `GITHUB_TOKEN` — um Personal Access Token com permissão de leitura e
  escrita nesse repo (escrita é necessária para criar/editar notas)
- `VAULT_BRANCH` e `VAULT_SUBPATH` — opcionais
- `GEMINI_API_KEY` — chave da API do Gemini (https://aistudio.google.com/apikey)
- `GEMINI_MODEL` — opcional, o padrão é definido em `src/lib/agente.ts`
- `SENHA_HASH` — hash da senha de acesso; gere com `npm run gerar-senha`
- `SEGREDO_SESSAO` — chave (32+ caracteres) que assina o cookie de sessão;
  gere com `npm run gerar-segredo`

Sem `VAULT_REPO`/`GITHUB_TOKEN`, a página mostra uma tela explicando o que
falta em vez de quebrar. Sem `SENHA_HASH`/`SEGREDO_SESSAO`, o login recusa
todo acesso (503) em vez de deixar o vault exposto por descuido.

## Rodar

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm test          # suíte de testes (Vitest)
npm run test:coverage
```

Abre em http://localhost:3000.

## Mapa dos arquivos

| Arquivo | O que faz |
| --- | --- |
| [src/app/page.tsx](src/app/page.tsx) | Roda no servidor: busca a árvore e o grafo do vault, e decide entre a tela normal ou a de configuração. |
| [src/app/api/chat/route.ts](src/app/api/chat/route.ts) | Rota do chat: valida sessão e corpo, chama o agente, devolve a resposta e as ferramentas usadas. |
| [src/app/api/notas/[...caminho]/route.ts](src/app/api/notas/[...caminho]/route.ts) | Rota que devolve o conteúdo de uma nota, para o painel de leitura buscar sob demanda. |
| [src/app/api/login/route.ts](src/app/api/login/route.ts) / [logout/route.ts](src/app/api/logout/route.ts) | Confere a senha e cria o cookie de sessão / apaga o cookie. |
| [src/app/login/page.tsx](src/app/login/page.tsx) | Tela de login (senha). |
| [src/proxy.ts](src/proxy.ts) | Exige sessão válida antes de qualquer rota (páginas e API), redireciona pro login. |
| [src/components/PaginaPrincipal.tsx](src/components/PaginaPrincipal.tsx) | Monta a tela interativa: cabeçalho, barra lateral, grafo de fundo, chat e o painel de leitura. Guarda o estado compartilhado entre eles. |
| [src/components/ConfiguracaoNecessaria.tsx](src/components/ConfiguracaoNecessaria.tsx) | Tela mostrada quando o vault não pôde ser carregado. |
| [src/components/BarraLateral.tsx](src/components/BarraLateral.tsx) | A árvore de pastas e notas. Se desenha recursivamente. |
| [src/components/GrafoDeFundo.tsx](src/components/GrafoDeFundo.tsx) | O grafo animado em canvas: física do `d3-force` + uma "respiração" e um pulso desenhados por cima. |
| [src/components/LeitorDeNota.tsx](src/components/LeitorDeNota.tsx) | Painel flutuante com o conteúdo de uma nota, em Markdown. |
| [src/components/Chat.tsx](src/components/Chat.tsx) | Lista de mensagens, campo de texto e a chamada real para `/api/chat`. |
| [src/components/Mensagem.tsx](src/components/Mensagem.tsx) | Uma bolha de mensagem (Markdown para o agente) + as pastilhas de ferramentas usadas, com link pro commit quando houve escrita. |
| [src/lib/types.ts](src/lib/types.ts) | Os tipos compartilhados (mensagem, item do vault, uso de ferramenta). |
| [src/lib/agente.ts](src/lib/agente.ts) | O laço de function calling com o Gemini. |
| [src/lib/ferramentas.ts](src/lib/ferramentas.ts) | As ferramentas que o agente pode chamar: buscar/listar/ler (leitura) e criar/editar nota (escrita, gera commit). |
| [src/lib/github.ts](src/lib/github.ts) | Fala com a API REST do GitHub — árvore de arquivos, leitura de blob e escrita de arquivo (commit). |
| [src/lib/vault-real.ts](src/lib/vault-real.ts) | Transforma a árvore do GitHub em pastas/notas, busca/lê/cria/edita notas e mantém um cache curto. |
| [src/lib/grafo.ts](src/lib/grafo.ts) | Baixa o conteúdo de todas as notas, acha os links `[[assim]]` e monta o grafo. |
| [src/lib/sessao.ts](src/lib/sessao.ts) / [autenticacao.ts](src/lib/autenticacao.ts) | Cookie de sessão assinado (HMAC) e a ponte com requisições HTTP. |
| [src/lib/senha.ts](src/lib/senha.ts) / [limite-de-tentativas.ts](src/lib/limite-de-tentativas.ts) | Hash/verificação da senha de acesso e o limitador de tentativas de login. |
| [src/app/globals.css](src/app/globals.css) | A paleta de cores, em variáveis CSS. Modo claro e escuro. |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Vitest

## Próximas etapas

O roteiro original (`etapas-futuras/`) está implementado: agente com function
calling, ferramentas de leitura e escrita, e a UI mostrando o que ele fez.
O que sobrou como ideia futura, não como plano concreto:

- Testes E2E cobrindo o fluxo de login + chat de ponta a ponta.
- Streaming da resposta do agente (hoje a resposta só chega inteira no fim).
- Desfazer/histórico de escritas feitas pelo agente, além do que o próprio
  histórico de commits do Git já oferece.
