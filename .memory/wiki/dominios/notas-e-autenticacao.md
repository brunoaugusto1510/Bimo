# Notas, persistência e autenticação

Verificação local: 26/10/2026. Esta página descreve contratos observados no código; não verifica configuração nem dados de produção.

## Identidade e armazenamento

O aplicativo web organiza notas por pasta e título, mas a identidade utilizada pela interface e pelo serviço é um ID opaco. Renomear ou mover preserva a identidade. A pasta é organização; não é um nó independente de conhecimento.

`RepositorioDeNotas` é o contrato usado por serviço, rotas e ferramentas. Há implementação no banco e uma implementação em memória, descartável, para desenvolvimento e testes. A configuração recusa memória em produção e carrega o banco somente depois de validar os parâmetros necessários.

O schema reúne notas, versões, fontes, entidades, relações e proveniência, além das tabelas operacionais da Wiki Viva. As funções de domínio mais antigas e o repositório integrado coexistem; siga o caminho efetivamente chamado pela funcionalidade antes de assumir que uma operação passa pela mesma fachada.

## Concorrência e histórico

Atualizações e renomeações levam uma revisão-base. Conflitos retornam o conteúdo atual para decisão explícita. O autosave serializa a escrita de cada nota e usa checkpoints para organizar versões da sessão de edição.

O índice de ligações deriva `[[links]]` do Markdown. Renomeação e movimento podem reescrever referências nos textos afetados. As relações visuais entre notas não devem ser espelhadas manualmente na tabela genérica de relações.

## Sessão e autorização

O fluxo web atual usa senha única e cookie de sessão assinado. A existência de schema e planos de contas não significa que o login multiusuário esteja ativo.

O proxy protege páginas e APIs. As exceções de manutenção da wiki são específicas da rota e do método, com segredo exclusivo. As rotas também verificam sessão; escritas de navegador conferem mesma origem e o contrato HTTP. Segredos de Cron e executor não concedem acesso geral ao aplicativo.

Consultas do banco filtram o dono explicitamente. RLS é defesa adicional; não substitui os filtros da aplicação quando a conexão tem privilégios elevados.

Falhas de configuração do armazenamento podem produzir a tela de configuração necessária. Falhas na configuração de autenticação recusam acesso. Preserve essa diferença ao tratar indisponibilidade.

## Onde conferir

- [Contrato das notas](../../../src/lib/repositorio-de-notas/tipos.ts), [configuração](../../../src/lib/repositorio-de-notas/config.ts), [seleção do repositório](../../../src/lib/repositorio-de-notas/index.ts), [banco](../../../src/lib/repositorio-de-notas/banco.ts) e [memória](../../../src/lib/repositorio-de-notas/memoria.ts).
- [Serviço](../../../src/lib/servico-de-notas.ts), [índice de ligações](../../../src/lib/indice-de-ligacoes.ts) e [schema](../../../src/lib/db/schema/index.ts).
- [Proxy](../../../src/proxy.ts), [autenticação HTTP](../../../src/lib/autenticacao.ts), [sessão](../../../src/lib/sessao.ts), [contrato HTTP das notas](../../../src/lib/http-de-notas.ts) e [rota de processamento da wiki](../../../src/app/api/wiki/processar/route.ts).
- [Plano histórico de contas](../documentacao/Bimo%20-%20Plano%20de%20Login%20Multiusuario.md) e [histórico das notas no banco](../documentacao/Bimo%20-%20Plano%20de%20Notas%20no%20Banco.md).

Relacionadas: [interface](interface-e-grafo.md), [agente](agente-e-ingestao.md) e [Wiki Viva](wiki-viva.md).

## Lacuna de exclusão de notas — 30/10/2026

- Conferência estática após relato do usuário: `RepositorioDeNotas` oferece criação, atualização e renomeação, sem operação de exclusão; `/api/notas/[id]` exporta apenas `GET` e `PATCH`. A interface de nota examinada não oferece apagar.
- Proposta ainda não aprovada: ação no menu da nota para mover à lixeira, com confirmação e restauração. Ao implementar, coordenar com autosave/abas, invalidar listagem/busca/grafo e tratar as evidências da Wiki Viva quando a origem deixar de estar disponível.
- Somente diagnóstico local e documentação nesta tarefa; nenhum código funcional, dado remoto ou migração alterado. Não define ainda retenção, exclusão definitiva ou política de restauração.

### Lixeira aceita e implementada localmente — 30/10/2026

- Após o diagnóstico acima, o usuário escolheu "lixeira com restauração". O repositório agora oferece `listarLixeira`, `moverParaLixeira` e `restaurarNota`, implementados em memória e Postgres. As rotas são GET `/api/notas/lixeira` e POST `/api/notas/[id]/lixeira` ou `/restaurar`, com sessão, mesma origem nas escritas, capacidade de escrita e revisão-base.
- `notas.removida_em` oculta a nota das leituras/escritas normais. O índice de título/pasta passa a ser parcial, somente sobre notas ativas. Restaurar preserva ID, conteúdo, pasta, tags, versões e publicações; recusa colisões de título sem sobrescrever nada. Não há purga nem expiração automática.
- A interface web confirma a remoção no menu da nota e lista a lixeira no rodapé da barra lateral (menu de notas no celular). A fila do editor salva o texto pendente antes de remover e só limpa o rascunho após sucesso. Falhas/conflitos preservam o texto. A confirmação pertence ao ID da nota; navegar não a transfere.
- Remoção confirmada limpa históricos/abas/recentes e protege a interface contra respostas anteriores à escrita. Leituras posteriores voltam a representar o estado do servidor. A Wiki deixa de processar fontes removidas, invalida posses em voo e oculta metadados de neurônios na lixeira; evidências e publicações históricas são preservadas para restauração.
- A migração `0013_lixeira.sql` foi gerada e testada somente em PGlite, **não aplicada ao banco real**. Aplicá-la antes de rodar/publicar o novo código com persistência. [Entrega, validações e limites](../verificacoes/2026-10-30-lixeira.md).
