# Consolidação de blockchain/economia e prevenção de duplicatas

Data: 30/10/2026. Autorização: “pode fazer”, em resposta à recomendação de consolidar a duplicata e enriquecer os seis temas da [avaliação anterior](2026-10-30-neuronios-blockchain-economia.md).

## Resultado no acervo real

- Revisados os neurônios 4869 (Criptoeconomia), 4870 (Bitcoin), 4871 (Blockchain), 4872 (Mercados), 4874 (Tokenização) e 4875 (Web 3).
- Os textos agora explicam relações sustentadas entre ativo, tecnologia, representação e posse; inferências estão identificadas. Foram acrescentados contexto temporal das anotações de 2025, procedência de material compartilhado/ChatGPT e perguntas específicas sobre definições, métricas e alcance das afirmações.
- O neurônio 4873 tornou-se **registro histórico redirecionado para 4872**, mantendo título, caminho e id. Foi protegido e pausado. A revisão atual não tem afirmações/fontes: não oferece outra síntese duplicada nem vira evidência. `estrutura.manutencao` registra a consolidação. As publicações anteriores permanecem intactas.
- Os seis temas não apontam mais à duplicata; os links anteriores externos ao recorte continuam chegando ao caminho preservado, que indica a página principal. Não houve reescrita de notas pessoais.
- Resultado: **30 afirmações e 50 evidências** distribuídas nos seis temas. O conjunto ainda tem sete registros físicos, incluindo o redirecionamento histórico.

## Escrita e verificação

Operação manual de manutenção via conector Supabase, restrita ao projeto Bimo e ao mesmo dono dos ids examinados. Não foi disparada a fila nem um modelo externo.

Antes da escrita, relidos os sete neurônios, seus snapshots atuais e as dez notas do recorte (oito origens e dois apontadores de slides). Guardados snapshot anterior, proposta, SQL e resultado verificado em `.vercel/wiki-revisao-20261030/`, diretório ignorado pelo Git. Esses arquivos contêm conteúdo privado do acervo e não devem ser adicionados a commits.

O SQL usa um único bloco transacional, o mesmo advisory lock por dono utilizado pelo aplicativo, locks nas linhas, conferência de conteúdo/revisão e recusa de proteção/pausa/edição aberta ou trabalho ativo. Publica nova revisão da nota, snapshot da Wiki, versão da nota, gerenciamento e evento no Diário. Nenhuma linha de histórico foi apagada ou reescrita, nenhuma nota foi excluída e não houve DDL/migração.

Ensaio em PGlite antes de aplicar:

- um conflito de evento introduzido após várias escritas reverteu o bloco inteiro;
- sete publicações novas preservaram as dez notas de origem;
- uma segunda aplicação foi recusada pelas revisões-base;
- ensaio local não substituiu a conferência do banco real após escrever.

Conferência real posterior, sem divergências:

- sete conteúdos/revisões e metadados iguais à proposta;
- as 50 evidências coincidem literalmente com os trechos atuais;
- dez notas do recorte mantêm conteúdo, revisão, título e pasta anteriores;
- sete snapshots antes atuais mantêm fontes, afirmações e estrutura iguais;
- 15 snapshots no total, sete novas versões de nota e sete eventos da manutenção;
- 4869 passou da revisão 2 para 3; os outros seis registros, de 1 para 2.

## Código local

Checkout `main`, HEAD `9a50857`, sem trocar branch e preservando as mudanças anteriores de busca do chat e o worktree de login.

- [identidade.ts](../../../src/lib/wiki/identidade.ts): identidade temática ignora apenas sufixos finais repetidos de `(síntese)`, espaços e diferenças de caixa/acentos. Outros qualificadores continuam significativos.
- [automacao.ts](../../../src/lib/wiki/automacao.ts): compara chave, aliases e título atual dos neurônios; recusa uma nova página quando a identidade já existe ou é ambígua. Não escolhe uma duplicata arbitrariamente. Propostas equivalentes na mesma resposta não geram duas publicações. Enriquecer ainda exige leitura e alvo válido.
- [observabilidade.ts](../../../src/lib/wiki/observabilidade.ts): diagnóstico também reconhece os sufixos, sem fundir automaticamente. Registros com marca explícita de consolidação ficam fora dos temas ativos do Cérebro e da manutenção periódica, evitando tratá-los como órfãos ou novas duplicatas.
- [tipos.ts](../../../src/lib/wiki/tipos.ts): documenta a procedência de manutenção e o destino do registro consolidado.
- [gerador.ts](../../../src/lib/wiki/gerador.ts): orienta ler um destino só do índice em vez de recriá-lo; explicar relações sustentadas, marcar inferências, preservar contexto temporal e reconhecer fontes compartilhadas.

## Validação local

- RED significativo: **5 falhas e 32 testes passando**, em três arquivos, antes de alterar o código de produção. Reproduziu criação com sufixos, renomeação, duplicata na mesma resposta e diagnóstico incompleto.
- GREEN inicial: **41 testes em quatro arquivos** (incluindo identidade e preservação de qualificadores).
- Suíte final da Wiki Viva: **314 testes em 28 arquivos**, incluindo PGlite e o caso do registro consolidado, sem conexão ao Supabase pelos testes. Após o ajuste final que preserva redirecionamentos como destinos legíveis, os oito testes de observabilidade passaram novamente.
- TypeScript (`tsc --noEmit`) e ESLint dos nove arquivos alterados/criados passaram. O último ajuste em observabilidade também recebeu lint específico.
- `git diff --check` passou; houve apenas aviso de conversão de LF para CRLF em arquivo preexistente de outro escopo.

## Limites e próximos passos

- **Acervo real atualizado; código preventivo somente local, sem commit, push ou deploy.** A geração hospedada ainda não recebeu a correção de identidade/prompt. O aplicativo atualmente publicado pode mostrar o registro histórico como neurônio pausado; sua revisão sem fontes o exclui da recuperação normal da Wiki. A exclusão explícita do Cérebro/lint passa a valer quando o código local for publicado.
- O fluxo de manutenção usado aqui é uma operação dirigida e auditada; não foi criada ferramenta geral de fusão para o usuário nem uma rotina de fusão automática.
- A identidade corrigida não é um detector universal de paráfrases semânticas. A qualidade de saídas futuras do prompt não foi avaliada com modelo real.
- Não houve verificação externa das definições técnicas/econômicas, dos números históricos ou leitura do PPTX. As perguntas e atribuições preservam esses limites.
- Não houve `.env`, chamada paga, processamento da fila, migração, commit, push ou deploy. A decisão de publicar o código é separada desta manutenção já autorizada e concluída no acervo.
