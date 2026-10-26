# Coding Patterns

*Document established coding conventions, file structures, and UI/UX patterns here.*

## Convenções verificadas em 26/10/2026

As regras e os padrões foram sintetizados a partir do código, dos testes e de `CLAUDE.md`. São instruções para preservar contratos existentes; os detalhes de cada domínio estão no [índice](index.md).

### Linguagem e contratos

- Use português do Brasil em código novo, comentários e interface. O vocabulário exposto é “notas”; preserve nomes legados ao documentar o mobile, sem espalhá-los para novos fluxos.
- Prefira uniões discriminadas para estados e resultados. Uma gravação distingue sucesso, conflito, indisponibilidade de escrita, identidade ausente e título já usado.
- A identidade de uma nota é um ID opaco. Pasta, título e caminho são atributos mutáveis. Resolva nomes ambíguos explicitamente.
- O código acima da persistência usa `RepositorioDeNotas`; implementações de armazenamento compartilham uma suíte de contrato.

### Escrita e concorrência

- Toda atualização leva `revisaoBase`. Um conflito real requer escolha explícita; não adote silenciosamente uma revisão concorrente.
- O salvamento automático serializa escritas por nota, incluindo operações exclusivas de renomeação. Se o servidor devolve o conteúdo que acabou de ser enviado, o cliente pode reconhecer uma resposta perdida e adotar a revisão correspondente.
- A substituição feita pelo agente exige leitura da nota na mesma execução e usa a revisão lida. Acrescentar texto tem tratamento próprio; não generalize sua retentativa para substituições.
- Efeitos já gravados continuam existindo quando o chat falha ou é cancelado. O histórico e o estado de execução precisam refletir a escrita concluída.

### Fronteiras do servidor

- Verifique sessão nas rotas além do proxy. Escritas de navegador verificam também mesma origem, JSON, tamanho e schema.
- Configure notas com degradação controlada quando falta armazenamento; autenticação sem configuração recusa acesso. São comportamentos distintos.
- Carregue o banco depois de validar a configuração. Consultas por dono filtram `user_id` explicitamente, inclusive quando a conexão tem privilégios superiores aos de RLS.
- Erros destinados ao cliente e ao modelo são genéricos. Logs de infraestrutura usam categorias seguras; não incluem texto das notas, prompts ou credenciais.

### Interface e grafo

- Preserve a árvore estável que mantém chat e grafo montados durante a navegação entre modos.
- Atualize os dados das notas e do grafo pelo cliente de dados existente. Evite atualizar a página inteira para refletir uma gravação.
- Leia armazenamento local como entrada não confiável e preserve rascunhos diante de falhas.
- Tokens semânticos de cor e tema ficam em `globals.css`; o canvas precisa acompanhar mudanças de tema. Use as regras do design existente.
- `[[links]]` são interpretados a partir do texto; as relações visuais das notas não devem ganhar um segundo armazenamento concorrente de arestas.

### Wiki Viva

- Gere propostas estruturadas e valide no servidor. A existência de uma citação não comprova a conclusão semântica.
- Preserve raízes pessoais, distinção entre informação explícita e inferência, edição humana e contexto das divergências.
- Faça inferência fora da transação; valide posse, geração e revisões novamente na publicação atômica.
- Reserve orçamento antes do pedido e conserve consumo incerto. Pagamento, publicação e avanço da fila são etapas distintas.

### Testes e documentação

- Testes web ficam junto do código; o Vitest coleta `src` e `scripts`, com exclusões para mobile e worktrees. O mobile tem Jest próprio.
- Para validação local, selecione suites que não dependam de credenciais ou banco remoto. Integrações com Supabase criam usuários efêmeros e nunca devem usar o dono real como dado descartável.
- Não transforme contagem de arquivos em contagem de testes aprovados. Não use resultado antigo como prova de um checkout alterado.
- Na MemWiki, mantenha resumo no domínio, evidências nos documentos datados e navegação no índice. Atualize `hot.md` e acrescente o registro em `log.md`; não apague resultados históricos.

Fontes de navegação: [contrato de notas](../../src/lib/repositorio-de-notas/tipos.ts), [autosave](../../src/lib/edicao/salvamento-automatico.ts), [porta de escrita do agente](../../src/lib/porta-de-escrita-do-agente.ts), [proxy](../../src/proxy.ts), [espaço de trabalho](../../src/components/EspacoDeTrabalho.tsx), [automação da wiki](../../src/lib/wiki/automacao.ts), [Vitest](../../vitest.config.mts) e [regras do repositório](../../CLAUDE.md).

