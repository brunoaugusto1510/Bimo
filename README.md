# Bimo (Personal Brain)

Um espaço de notas com um assistente: as suas notas moram no banco do Bimo, você
as lê e escreve num editor com abas e salvamento automático, e um agente do
GPT-6 Luna consulta e escreve nelas por function calling na Responses API da OpenAI.

## Onde o projeto está agora

**Notas no banco, editor completo, agente, tudo atrás de login.**

- notas guardadas no Postgres (Supabase), com histórico de versões e controle de
  concorrência: uma gravação em cima de uma nota que mudou é recusada em vez de
  sobrescrever
- espaço de trabalho com abas, "Ir para nota" (Ctrl+O), nota nova (Alt+N),
  prévia ao passar o mouse numa ligação `[[assim]]`, tema claro e escuro
- editor com salvamento automático, renomear, mover de pasta, tags,
  autocompletar `[[ligações]]`, `#tags` e o menu `/`, e um rascunho do Bimo
  ("continuar", "resumir", "melhorar") que só entra na nota se você aceitar
- um grafo animado atrás do chat, com uma bolinha por nota e uma linha por
  ligação
- chat com o agente: ele busca, lista e lê as notas antes de responder e, quando
  você pedir, cria ou edita notas; a resposta mostra as ferramentas usadas e a
  nota gravada abre com um clique
- acesso por senha (cookie de sessão assinado)

O andamento detalhado e as pendências conhecidas estão em
[docs/Bimo - Plano de Notas no Banco.md](docs/Bimo%20-%20Plano%20de%20Notas%20no%20Banco.md).

## Configurar

Copie `.env.example` para `.env` e preencha. O essencial:

- `DATABASE_URL` e `USER_ID_PADRAO` — o banco das notas e o usuário dono delas
- `SENHA_HASH` — hash da senha de acesso; gere com `npm run gerar-senha`
- `SEGREDO_SESSAO` — chave (32+ caracteres) que assina o cookie; gere com
  `npm run gerar-segredo`
- `OPENAI_API_KEY` — chave da API OpenAI para o agente principal do chat
- `OPENAI_MODEL` — opcional; padrão `gpt-6-luna`
- `GEMINI_API_KEY` — chave Gemini para rascunhos no editor e ingestão (https://aistudio.google.com/apikey)

Sem `DATABASE_URL`/`USER_ID_PADRAO`, a página mostra uma tela explicando o que
falta em vez de quebrar. Sem `SENHA_HASH`/`SEGREDO_SESSAO`, o login recusa todo
acesso (503) em vez de deixar as notas expostas por descuido.

Para desenvolver sem banco, `NOTAS_FONTE=memoria` usa notas de exemplo na memória
(recusado em produção). As migrações do banco rodam com `npm run db:migrate`.

O chat usa raciocínio `low`, até cinco chamadas de 4.096 tokens de saída cada
(incluindo raciocínio), com prazo de 45 segundos. O histórico aceita até 40
mensagens, 20 mil caracteres por mensagem e 80 mil no total; o contexto montado
com ferramentas é limitado a 200 mil caracteres serializados. Notas grandes não
são cortadas silenciosamente: o pedido é interrompido antes de reenviá-las ao modelo.
O consumo de cada chamada é registrado no servidor sem texto das notas ou chave.
Esses limites não são um teto financeiro mensal. As respostas usam `store: false`;
isso não equivale a uma garantia de retenção zero pelo provedor.

Na hospedagem, configure `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL`, e faça
um novo deploy. Sem a chave OpenAI, o chat responde 503; não há troca automática
para Gemini. Se uma escrita terminar antes de uma falha/cancelamento, a escrita
permanece salva: cancelar a resposta não desfaz operações já concluídas.

## Wiki Viva

A Wiki Viva integrada descobre conexões nas notas salvas, cria ou enriquece sínteses na mesma base e disponibiliza evidências nas ferramentas do agente. Usa busca textual, aliases e origens pessoais, sem exigir embeddings ou seleção de notas. As telas Cérebro, Diário e neurônio e a apresentação no grafo estão integradas à página principal.

Em um ambiente novo, revise e aplique as migrações `0007`–`0011`, configure `WIKI_VIVA_ATIVA=1`, `WIKI_AUTOMATICA_ATIVA=1`, `WIKI_TETO_TOKENS_DIA`, `WIKI_EXECUTOR_SEGREDO` e `CRON_SECRET`. Reinicie a aplicação. O Cron diário da Vercel processa a fila; `npm run wiki:executar`, apontando `BIMO_URL` para o servidor, permite acelerá-la em um processo independente. A geração usa a configuração OpenAI existente. Os padrões permanecem desligados; gerar os arquivos de migração não altera o banco. A produção do Bimo já foi ativada; não reaplique migrações fora do histórico do Drizzle.

Salvar não espera pelo modelo. A fila persistente agrupa autosaves, recupera a base anterior em lotes e publica nota, histórico, evidências e progresso atomicamente. Edições manuais ficam protegidas. Orçamento é reservado antes de cada chamada; consumo incerto continua comprometido. O teto é em tokens por usuário/dia UTC, sem equivalência fixa em dinheiro.

Não há página nem rota para compilar à mão: a manutenção é só pela fila. `GET /api/wiki` expõe o índice e as evidências das sínteses para as telas e o agente. Em memória, os dados são descartáveis e não servem para produção. Citação literal verificada não comprova uma inferência: a qualidade semântica exige avaliação com notas aprovadas. Veja [operação, ativação, limites e testes](./docs/Bimo%20-%20Wiki%20Viva%20-%20Operacao.md).

## Rodar

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm test          # suíte de testes (Vitest); parte dela usa o banco de verdade
npm run test:coverage
npm run build
```

Abre em http://localhost:3000. Os testes de integração criam e apagam um usuário
efêmero no Supabase configurado: nunca aponte para um banco de produção.

## Mapa dos arquivos

| Onde | O que faz |
| --- | --- |
| [src/proxy.ts](src/proxy.ts) | Exige sessão válida antes de qualquer rota (páginas e API) e redireciona para o login. |
| [src/app/page.tsx](src/app/page.tsx) | Roda no servidor: carrega a árvore e o grafo das notas e decide entre a tela normal e a de configuração. |
| [src/app/api/](src/app/api) | Rotas: `notas` (ler, criar, gravar, renomear, ligações, tags, busca), `grafo`, `chat`, `bimo/rascunho`, `login` e `logout`. |
| [src/components/PaginaPrincipal.tsx](src/components/PaginaPrincipal.tsx) | O estado interativo da tela; `EspacoDeTrabalho` mantém uma árvore React estável entre os modos Bimo e Notas. |
| [src/components/AbaDeNota.tsx](src/components/AbaDeNota.tsx) e [EditorDeNota.tsx](src/components/EditorDeNota.tsx) | A nota aberta: título, propriedades, editor e leitura. |
| [src/components/Chat.tsx](src/components/Chat.tsx) | O chat com o agente. |
| [src/lib/repositorio-de-notas/](src/lib/repositorio-de-notas) | O contrato das notas (`tipos.ts`), o banco (`banco.ts`), a memória para testes e a escolha da fonte (`config.ts`, `index.ts`). |
| [src/lib/servico-de-notas.ts](src/lib/servico-de-notas.ts) | Árvore, grafo, ligações e cache por marca de versão, sobre o repositório. |
| [src/lib/edicao/](src/lib/edicao) | Salvamento automático, rascunho local e o autocompletar do editor. |
| [src/lib/espaco-de-trabalho/](src/lib/espaco-de-trabalho) | Estado das abas e os hooks do espaço de trabalho. |
| [src/lib/agente.ts](src/lib/agente.ts) e [ferramentas.ts](src/lib/ferramentas.ts) | O laço de function calling e as ferramentas: buscar, listar e ler; criar e editar. |
| [src/lib/rascunho-do-bimo.ts](src/lib/rascunho-do-bimo.ts) | O rascunho do Bimo no editor (somente leitura nas notas, texto puro). |
| [src/lib/sessao.ts](src/lib/sessao.ts), [senha.ts](src/lib/senha.ts), [autenticacao.ts](src/lib/autenticacao.ts) | Cookie de sessão assinado, verificação da senha e a ponte com as requisições. |
| [src/app/globals.css](src/app/globals.css) | A paleta de cores em variáveis CSS, claro e escuro. |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle +
Supabase (Postgres) · OpenAI (chat) · Gemini (rascunho e ingestão) · Vitest

## Ideias futuras

Não são plano concreto:

- Login multiusuário (hoje há um usuário só, `USER_ID_PADRAO`).
- Testes E2E do fluxo de login, edição e chat.
- Streaming da resposta do agente (hoje ela chega inteira no fim).
- Exportação periódica das notas para um repositório do GitHub, caso queira uma
  cópia legível fora do banco.
