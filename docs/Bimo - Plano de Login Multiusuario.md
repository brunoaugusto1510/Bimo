# Bimo — Plano de Login Multiusuário (v2, revisado)

Substitui a senha única (`SENHA_HASH` + cookie assinado) e o `USER_ID_PADRAO` por contas reais.
Andamento e decisões ficam aqui, não no CLAUDE.md.

Revisões incorporadas nesta versão: ECC `architect`, ECC `security-reviewer`, skills `supabase` e
`supabase-postgres-best-practices` (conferidas na documentação atual do Supabase). Codex: pendente (adendo no fim).

## Decisões (20/10/2026)

- **Base:** Supabase Auth, escondido atrás da porta `ServicoDeContas` (estilo `RepositorioDeNotas`).
  Só `src/lib/contas/supabase*.ts` importa `@supabase/*` para auth. Saída futura: UUIDs, hashes bcrypt
  (`auth.users.encrypted_password`) e identidades Google (`auth.identities`) migram; só as sessões caem.
- **Cadastro:** só por convite. **Defesa em profundidade** contra "signup" religado no painel: só entra quem
  tem `app_metadata.convidado = true` (gravado pelo servidor com a service role; `user_metadata` é editável
  pelo usuário e nunca é usado para autorização). O proxy recusa sessão sem essa marca.
- **Recursos:** entrar com e-mail/senha, sair, esqueci minha senha, tela Conta (trocar senha e e-mail,
  sessões, sair dos outros/de todos), entrar com Google, excluir minha conta.
- **Admin:** `ADMIN_USER_IDS` (UUIDs, não e-mails: e-mail muda e pode ser reaproveitado). Calculado no servidor
  a cada requisição, nunca guardado em cookie/JWT. O último admin não pode excluir a própria conta.
- **RLS continua ligado** nas 8 tabelas (policies de dono `TO authenticated` com `auth.uid()`): é a defesa contra
  acesso pela Data API com a chave publicável. O app conecta como dono do banco e passa por cima; por isso todo
  `where` filtra `user_id` e há teste de isolamento. Papel de banco sem `BYPASSRLS` fica como dívida registrada.

## Fatos conferidos na documentação (Supabase, out/2026)

- `getClaims()` valida a assinatura em cada chamada: local com chave assimétrica, chamada ao Auth com simétrica.
  `getUser()` consulta o servidor. `getSession()` nunca para autorização.
- No proxy do Next 16: chamar `getClaims()` em toda requisição, gravar os cookies renovados em `request.cookies`
  **e** na resposta, e devolver a resposta construída pelo `setAll` (ou copiar cookies e cabeçalhos de cache).
  `@supabase/ssr` ≥ 0.10 passa `headers` no `setAll` (`Cache-Control: private, no-store`): repassar sempre.
- Links de e-mail (convite, reset, confirmação) usam `token_hash` + `verifyOtp` em `/auth/confirm`; PKCE
  (`exchangeCodeForSession`) fica só para o Google. Convite é disparado no servidor: sem `code_verifier`.
- `updateUser({ password, current_password })` existe (supabase-js ≥ 2.102; temos ^2.112): troca de senha sem
  abrir outra sessão.
- Vínculo automático Google ↔ conta com o mesmo e-mail só ocorre com e-mail verificado.
- **Não confirmado na doc (teste de fumaça obrigatório na fase 4):** (a) "signup desligado" também bloqueia
  usuário novo via Google; (b) o JWT traz `session_id`; (c) proteção contra senhas vazadas depende do plano.
- Deletar usuário não invalida access tokens já emitidos. Como o app lê o banco como dono, as ações sensíveis
  conferem se o `session_id` ainda existe em `auth.sessions`. Isso também permite **listar sessões** (aparelho,
  IP, último uso) na tela Conta, somente leitura, dentro do adaptador. Encerrar uma sessão específica só se o
  teste mostrar que é seguro; senão ficam "sair dos outros" e "sair de todos" pelo SDK.
- SMTP embutido tem limite baixo de e-mails por hora: produção pede SMTP próprio.

## Arquitetura

```text
proxy.ts  ── ÚNICO que renova cookies sb-* ── PontoDeCookies grava em request E response (inclusive 401/redirect)
rotas     ── exigirUsuario(request) → { usuario } | { recusa }   (só lê; getClaims; getUser nas ações de conta)
páginas   ── usuarioDaPagina() sobre cookies() (somente leitura)
obterRepositorio(usuario.id)  ← por requisição; NÃO guarda instância num slot global
ServicoDeContas (porta, src/lib/contas/tipos.ts)
  ├─ senha-unica.ts  (ponte temporária: bimo_sessao válido → { id: USER_ID_PADRAO }; some na fase 6)
  ├─ memoria.ts      (dev/testes; recusado em produção; mesma suíte de contrato)
  └─ supabase.ts + supabase-admin.ts (`import "server-only"`; único lugar que lê a service role)
```

Porta: `usuarioDoPedido`, `entrarComSenha`, `sair(escopo)`, `iniciarGoogle`, `concluirCallback(codigo)`,
`confirmarLinkDeEmail(tokenHash, tipo)`, `convidar`, `pedirRedefinicao`, `definirNovaSenha`,
`trocarSenha(atual, nova)` → `{tipo:"sem-senha"}` para conta só-Google, `trocarEmail`, `listarSessoes`, `excluirConta`.
Resultados são uniões discriminadas; nada de exceção entre camadas.

Cache e isolamento:
- `RepositorioDeNotas` ganha `dono` (userId). Cache do serviço de notas vira LRU por dono (~20 entradas + TTL),
  validado pela `marcaDeVersao` (que já filtra por `user_id`). `memoria` vira `Map<userId, repositório>`.
- `executarFerramenta` e `responder(mensagens, { repositorio })` recebem o repositório da rota, sem fallback.
  Apagar `portaLegada`/`vault-real` do agente (fonte GitHub já foi removida).

## Fases (cada uma pode ir para produção sozinha; TDD; revisão ECC + Codex ao fechar)

1. **Porta + adaptadores `memoria` e `senha-unica` + suíte de contrato.** Comportamento do app não muda.
2. **Isolamento primeiro:** `obterRepositorio(userId)`, LRU por dono, `memoria` por usuário, agente sem
   fallback, todas as rotas/páginas passam o `usuario.id`; `config.ts` e `ConfiguracaoNecessaria` deixam de
   pedir `USER_ID_PADRAO`. Auditoria por grep: todo `db.select/update/delete` filtra `user_id`. **Teste de
   isolamento bloqueante** (A escreve, B não lê/lista/busca/alcança por id, `ler_nota`, grafo, tags, ligações,
   fontes; inclui B pedindo enquanto a montagem de A está em andamento). Teste: RLS segue ligado nas 8 tabelas.
3. **Trancas e limites:** `exigirUsuario` (assíncrono) no proxy e nas rotas, via adaptador ativo; proxy exato em
   `PUBLICOS` (`/login`, `/api/auth/*`, `/esqueci-senha`, `/auth/confirm`), sem `startsWith`; `proximo` seguro.
   Limite persistente no Postgres (tabela nova, RLS ligado sem policies, `REVOKE` de `anon`/`authenticated`,
   `INSERT … ON CONFLICT` atômico, índice por expiração, limpeza ao gravar): login por e-mail normalizado **e**
   por IP, independentes; chat e rascunho **por usuário** com teto diário (hoje o rascunho usa uma chave global
   e o chat não tem limite). IP só de cabeçalho que a plataforma garante. Chat e rascunho com `lerJsonComLimite`,
   teto de mensagens/caracteres e confirmação de escrita verificada no servidor.
4. **Adaptador Supabase + login real:** `/login` (e-mail/senha, Google), `/api/auth/callback` (PKCE),
   `/auth/confirm` (`verifyOtp`), logout só POST. Redirect montado com `SITE_URL` fixo; helper único
   `caminhoInternoSeguro`. Rotas de conta usam `exigirMesmaOrigemEstrita` (Origin obrigatório). Mensagens
   idênticas para conta existente/inexistente. Cookies `sb-*` com opções explícitas (`httpOnly`, `sameSite=lax`,
   `secure` em produção). **Script `migrar-dono`** (simula por padrão, `--executar` grava): usa
   `admin.getUserById(USER_ID_PADRAO)`, define e-mail confirmado, marca `convidado`, gera link de redefinição.
   O dono NÃO é convidado (convite criaria UUID novo e as FKs impedem religar). Testar que Google com o mesmo
   e-mail cai no mesmo UUID. `scripts/importar-notas` troca `USER_ID_PADRAO` por `--usuario <uuid|e-mail>`.
5. **Convite e senha:** `POST /api/conta/convites` (admin, `getUser`, limite por admin/dia; grava
   `app_metadata.convidado`), `/definir-senha`, `/esqueci-senha`, `/redefinir-senha` (exigem a sessão criada
   pela confirmação; política mínima de 10 caracteres também no servidor; `signOut` global depois).
6. **Tela Conta e remoção da tranca antiga:** trocar senha (`current_password`), trocar e-mail, listar sessões,
   sair dos outros/de todos, excluir conta. Ações sensíveis: `getUser`, `session_id` vivo em `auth.sessions`,
   reautenticação recente. Exclusão: reautenticar → digitar o e-mail → `signOut` global → apagar o prefixo
   `<userId>/` do bucket `fontes` (paginado, idempotente) → `admin.deleteUser` (cascade limpa o banco) → limpar
   cookies; falha em qualquer passo devolve erro e pode repetir. Só depois de validar em produção: apagar
   `senha.ts`, `sessao.ts`, `senha-unica.ts`, scripts `gerar-senha`/`gerar-segredo`, `SENHA_HASH`/`SEGREDO_SESSAO`
   (confirmar com você antes). Conferir índices em `user_id` de todas as tabelas filhas (cascade sem índice varre
   a tabela inteira).
7. **Fechamento:** `.env.example`, CLAUDE.md (só regras), roteiro manual, rodar advisors do Supabase
   (Dashboard → Database → Advisors) após a migração, revisões finais (security, typescript, react, a11y, Codex).

## Checklist do painel do Supabase (feito por você)

1. Authentication → Sign In / Providers: **desligar "Allow new users to sign up"**; ligar "Confirm email" e
   "Secure email change" (confirmação nos dois endereços).
2. URL Configuration: Site URL e Redirect URLs **exatas, sem curinga**, de dev e produção.
3. Providers → Google: OAuth Client no Google Cloud (client id/secret no painel).
4. Templates de e-mail (convite, reset, confirmação, troca de e-mail) em pt-BR **usando `{{ .TokenHash }}`** e
   apontando para `/auth/confirm`; expiração curta para convite e reset.
5. Política de senha (mínimo 10); proteção contra senhas vazadas se o plano permitir; limites de taxa do Auth;
   SMTP próprio para produção; JWT com validade curta (10–15 min) para "sair de todos" valer rápido.
6. `.env`: `ADMIN_USER_IDS`, `SITE_URL`, chave publicável (`SUPABASE_PUBLISHABLE_KEY`); `SUPABASE_SERVICE_ROLE_KEY`
   já existe. Sem a service role só as rotas de conta/admin respondem 503; sem URL/chave publicável tudo recusa
   (fail closed). Nunca cole chaves no chat. Documentar rotação da service role.

## Riscos aceitos / dívidas

- App como dono do banco (RLS não o protege): mitigado por filtro `user_id`, teste de isolamento e auditoria.
- Access token vale até expirar após "sair de todos": mitigado por JWT curto e checagem de `session_id`.
- Fixação de Storage e backups do Supabase seguem a retenção deles (registrar na política de privacidade).

## Andamento

- [ ] Fase 1 · [ ] Fase 2 · [ ] Fase 3 · [ ] Fase 4 · [ ] Fase 5 · [ ] Fase 6 · [ ] Fase 7

## Adendo Codex

Revisão independente do Codex (20/10/2026). Quase tudo coincidiu com ECC e Supabase (identidade até o agente sem
fallback, RLS existente, migração do dono antes do corte, reautenticação na exclusão, fases intermediárias com
ponte legada, contrato de cookies, `token_hash` para convite/reset, admin por UUID, limites antes dos convites).
Itens **novos** incorporados como requisitos:

- **Isolamento no navegador (fase 2/6):** `localStorage` hoje usa chaves globais (`bimo_rascunho:<id>` em
  `edicao/rascunho-local.ts`, `bimo_espaco` em `espaco-de-trabalho/persistencia.ts`). Particionar por usuário
  (`bimo:<userId>:…`). Dados legados vão só para o dono, nunca atribuídos automaticamente a outro usuário.
  No logout ou troca de sessão: cancelar pedidos e a fila de `salvamento-automatico.ts`, limpar o estado visível e
  impedir que respostas antigas entrem na sessão nova. Teste: A → logout → B no mesmo navegador, preservando os
  rascunhos de A sem entregá-los a B. (Respeitar a regra de `PaginaPrincipal`: sem remontar `Chat`/`GrafoDeFundo`;
  trocar de usuário é navegação completa para `/login`, não troca de estado em memória.)
- **Exclusão de conta:** além da ordem já definida, bloquear novas operações da conta durante a exclusão e recusar
  pedidos em andamento; invalidar caches do dono.
- **Critério de aceite:** testes reais contra o adaptador Supabase (como `banco.test.ts`, com usuário efêmero),
  não só o adaptador em memória: isolamento, cookies, callbacks, indisponibilidade do provedor, logout e exclusão
  parcial.
