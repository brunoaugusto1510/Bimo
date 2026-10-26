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
