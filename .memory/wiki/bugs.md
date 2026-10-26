# Known Bugs & Quirks

*Document unresolved issues, edge cases, and weird system quirks here to prevent future agents from falling into the same traps.*

## Situação observada em 26/10/2026

Esta página separa divergências documentais, limitações confirmadas e problemas de execução. A ingestão não executou a aplicação nem reproduziu novos defeitos; nenhum item abaixo deve ser apresentado como incidente novo em produção.

### Divergência documental confirmada: limites do chat

O README descreve cinco voltas e prazo de 45 segundos. O arquivo `src/lib/agente.ts` observado define `MAX_VOLTAS = 12` e `TEMPO_MAXIMO_MS = 150_000`. Os números da documentação não devem orientar uma implementação sem nova conferência do código.

Correção proposta: alinhar README e demais descrições operacionais com os limites aprovados do agente e da rota HTTP, preservando o contexto dos relatórios históricos. O código está em evolução; esta ingestão não alterou limites, testes ou comportamento do aplicativo.

### Limitações e cuidados já presentes no desenho

- **Recuperação da wiki:** seleção textual, aliases e dependências usam recortes de candidatas e contexto. Não há promessa de recuperar toda relação semântica ou de percorrer o grafo por vários saltos.
- **Evidência literal:** validação de trecho/revisão e integridade referencial não provam a conclusão editorial. A avaliação humana e os ensaios continuam relevantes.
- **Mobile:** o provedor padrão é simulado. Renderizar as telas não comprova persistência, autenticação ou geração no backend real.
- **Integrações:** os testes remotos e os executores podem alterar dados ou consumir recursos. Uma checagem documental não deve dispará-los como efeito colateral.
- **Histórico:** a pesquisa de LLM Wiki de 23/10 descreve uma etapa anterior da ativação e do processamento. A documentação consolidada de 26/10 registra evolução posterior; ambas precisam conservar suas datas.

### Correções documentais concluídas

- Os três modelos vazios de stack, padrões e problemas foram preenchidos na ingestão.
- O contexto inicial e o índice passaram a apontar para páginas de domínio e para registros datados.
- A migração anterior corrigiu a referência da extração para `src/lib/extracao/index.ts`. Na checagem inicial desta ingestão, não havia link local quebrado na MemWiki.

Fontes: [agente](../../src/lib/agente.ts), [README](../../README.md), [recuperação da wiki](../../src/lib/wiki/recuperacao.ts), [consulta da wiki](../../src/lib/wiki/consulta.ts), [serviços mobile](../../mobile/src/servicos/ProvedorDeServicos.tsx) e [relatório de ingestão/lint](verificacoes/2026-10-26-ingest-lint.md).