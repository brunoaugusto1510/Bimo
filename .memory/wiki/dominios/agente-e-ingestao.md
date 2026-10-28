# Agente, rascunhos e ingestão de fontes

Verificação local: 26/10/2026. Os fluxos abaixo têm contratos e provedores distintos; não inferir integração apenas por coexistirem no repositório.

## Chat e ferramentas

O chat utiliza o transporte próprio da Responses API da OpenAI. O servidor recebe mensagens, executa chamadas de ferramentas e devolve texto e eventos do trabalho. Limites de voltas, prazo, histórico e contexto são definidos no código e podem mudar; há uma divergência documentada entre README e agente nesta ingestão, registrada em [problemas](../bugs.md).

As ferramentas buscam, listam, leem, criam e editam notas. O agente resolve caminhos contra o repositório configurado; nomes ambíguos não autorizam selecionar uma nota arbitrária. A substituição exige leitura na mesma execução e utiliza sua revisão. Escritas concluídas não são desfeitas por cancelamento da resposta.

As instruções mandam consultar as notas antes de responder sobre o acervo, tentar termos alternativos quando necessário e distinguir conhecimento geral de informação das origens. Essas são orientações ao modelo, não prova de comportamento semântico correto em qualquer resposta.

O transporte não deve expor erros internos nem registrar conteúdo das notas. A Wiki Viva acrescenta conhecimento e evidências às consultas; uma falha desse complemento não deve impedir a leitura normal das notas.

## Rascunho do editor

O rascunho usa Gemini, valida texto de entrada e retorna uma proposta para revisão. Esse fluxo é distinto da escrita das ferramentas do chat e da publicação automática de um neurônio.

## Fontes e extração

O domínio de fontes conserva material de origem e proveniência. O pipeline de ingestão tem extração de texto puro, PDF e página web e pode sugerir entidades e notas por saída estruturada do Gemini. Entidades sugeridas nascem como rascunho.

O processamento de uma fonte é explícito. Não há, por esta leitura, demonstração de uma tela de ingestão integrada ao fluxo completo da Wiki Viva. A presença dos extratores não permite afirmar suporte pronto a qualquer tipo de arquivo ou OCR de imagens.

## Onde conferir

- [Agente](../../../src/lib/agente.ts), [transporte OpenAI](../../../src/lib/openai.ts), [ferramentas](../../../src/lib/ferramentas.ts), [instruções](../../../src/lib/instrucao-do-agente.ts) e [porta de escrita](../../../src/lib/porta-de-escrita-do-agente.ts).
- [Rascunho](../../../src/lib/rascunho-do-bimo.ts) e [rota do editor](../../../src/app/api/bimo/rascunho/route.ts).
- [Fontes](../../../src/lib/fontes.ts), [ingestão](../../../src/lib/ingestao.ts), [fachada de extração](../../../src/lib/extracao/index.ts) e [proveniência](../../../src/lib/proveniencia.ts).
- [Registro histórico da Fase 3](../documentacao/Bimo%20-%20Sources%20%26%20Ingestion%20%28Fase%203%29.md) e [Wiki Viva atual](wiki-viva.md).

## 27/10/2026 — Planejamento da memória do aplicativo

O [plano completo de memória](../documentacao/Bimo%20-%20Plano%20do%20Sistema%20de%20Memoria.md) propõe conversas persistentes, preferências, decisões e pendências rastreáveis, contexto limitado, captura seletiva e esquecimento abrangendo os derivados. É uma proposta documental com fases F0–F8 e AC-001–030; não acrescenta essas funcionalidades ao código atual.

A base foi conferida no checkout `feat/wiki-viva-em-rede`, HEAD `e5d6394`: o chat conserva mensagens no estado do componente, o transporte usa Responses diretamente com `store: false` e a Wiki Viva já oferece índice e vizinhos. O plano mantém esses mecanismos de conhecimento e separa memória pessoal, histórico e resumos. A capacidade `Memory` documentada pela OpenAI pertence a Sandbox Agents; não é uma opção já ligada no transporte do Bimo.

As políticas de retenção, modo automático, informações sensíveis e uso sob dono único continuam para revisão. Nenhuma migração, teste de software ou validação remota foi executada neste planejamento.
