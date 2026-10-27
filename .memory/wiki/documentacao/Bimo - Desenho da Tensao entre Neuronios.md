# Bimo — desenho: tensão entre neurônios

Data: 27/10/2026. Base: branch `feat/wiki-viva-em-rede`, política `rede-v5`. **Proposta, não implementada.** Origem: lacuna 8 da [auditoria de 26/10](./Bimo%20-%20Auditoria%20da%20Estrutura%20da%20Wiki%20Viva%20vs%20LLM%20Wiki%20-%202026-10-26.md) e o ponto central da [fonte LLM Wiki](../fontes/llm-wiki-karpathy.md): ao chegar uma informação nova, marcar onde ela contradiz o que a wiki já afirma.

## O que existe hoje (lido no código)

- `DivergenciaWiki` (`src/lib/wiki/tipos.ts:20`) é um par `a`/`b` de ids de afirmações **do mesmo neurônio**, cada lado com um contexto.
- A proposta só aceita ids visíveis do alvo ou `nova:N` (`automacao.ts:388-395`). Um lado inválido descarta a proposta inteira (`"divergencia"`).
- Pares existentes sobrevivem enquanto as duas afirmações existirem. Retirar uma afirmação encerra o par; mudar a proposição exige reconfirmar o par (`automacao.ts:397-409`). Teto de 10 por neurônio.
- O texto da nota ganha a seção "Onde suas notas divergem" (`automacao.ts:423`). O neurônio fica `em_tensao` (`observabilidade.ts:15`), o lint gera o alerta `divergencias` e o Diário recebe `discordam` (`diario.ts`). `NeuronioAberto.tsx:119` mostra os dois lados.
- O chat **não** recebe divergências: `consulta.ts` devolve afirmações e evidências, sem `estrutura.divergencias`.

**A lacuna:** quando uma nota sustenta algo que contradiz uma afirmação de **outro** neurônio, o modelo só consegue registrar isso enriquecendo aquele outro neurônio, e só se o assunto couber nele. Dois neurônios de assuntos diferentes que afirmam coisas opostas não têm como ser marcados.

## Proposta: tensão entre neurônios

Uma **tensão** é um par de afirmações em neurônios diferentes. Pertence ao neurônio que a registra e aponta para uma afirmação de outro neurônio. O outro lado é derivado na leitura, como o `citadoPor` do índice.

### Tipo e armazenamento

```ts
// tipos.ts
export type TensaoWiki = {
  minha: { afirmacaoId: string; contexto: string };
  outra: { neuronioId: string; afirmacaoId: string; contexto: string };
};
// EstruturaWiki ganha: tensoes?: TensaoWiki[]
```

Fica em `paginas_wiki.estrutura` (jsonb), como `resumo`. **Sem migração.** `banco.ts` e `memoria.ts` passam a gravar `tensoes`, como já gravam `divergencias`.

### Escrita (descoberta)

- A proposta ganha `tensoes` (máx. 10), com a mesma forma.
- `minha.afirmacaoId`: id visível do alvo ou `nova:N`, resolvido como nas divergências.
- `outra.neuronioId`: uma **candidata lida** (tem metadados), diferente do alvo. `outra.afirmacaoId` precisa estar entre as afirmações que o modelo viu daquela candidata.
- A outra pode estar protegida ou pausada: a tensão **não escreve nela**. Isso vale também para o neurônio que a pessoa editou, e é justamente quando o aviso mais serve.
- Uma proposta `relacionar` sobre o neurônio N1 pode registrar tensão com N2. Assim, duas sínteses existentes que se contradizem também podem ser marcadas quando aparecem juntas como candidatas.
- Lado inválido descarta a proposta (`"divergencia"`), pela mesma regra de hoje: uma tensão pedida não pode sumir em silêncio.
- **Uma tensão implica uma ligação.** O servidor acrescenta `outra.neuronioId` às ligações, dentro do teto de 16, e o texto ganha o `[[link]]`. O grafo mostra a aresta sem tabela nova.
- Ciclo de vida igual ao das divergências: a tensão continua enquanto `minha` existir e a proposição não mudar. Mudar a proposição exige reconfirmar; retirar encerra.
- O texto do neurônio ganha, na seção "Onde suas notas divergem", linhas `afirmação (contexto) ↔ [[outro neurônio]]: afirmação (contexto)`.

### Prompt e política

- A política passa a `rede-v6` (`POLITICA_EDITORIAL`), gravada em cada publicação.
- Instrução nova em `gerador.ts`: quando uma afirmação desta proposta contradiz uma afirmação de outra candidata lida e as duas não pertencem ao mesmo neurônio, registrar em `tensoes`. Nenhum lado vence. Não trocar nem retirar a afirmação do outro neurônio. Contradição dentro do mesmo neurônio continua indo para `divergencias`.

### Leitura

- **Lado derivado:** `obterCerebroWiki` monta o inverso (quem registrou tensão com cada neurônio), filtrando tensões cujo `outra.afirmacaoId` já não exista. `estadoDoNeuronio` recebe esse conjunto: os **dois** neurônios ficam `em_tensao`.
- **Lint:** `verificarSinteses` acrescenta o alerta `divergencias` aos dois lados. O texto do alerta já serve, e o evento `discordam` no Diário vem de graça pela assinatura do diagnóstico.
- **Tela:** `NeuronioAberto` mostra as tensões na mesma seção, com o título do outro neurônio como link. O cliente já recebe todos os neurônios com afirmações (`obterCerebroWiki`), então resolve o outro lado sem requisição nova.
- **Chat:** `consultarConhecimentoWiki` passa a devolver, por neurônio, as divergências e as tensões ainda válidas, com o texto dos dois lados. Assim o agente não apresenta um lado como fato. Isso também fecha a falta de divergências internas no chat.

## Testes (TDD, repositório em memória)

Arquivo novo `src/lib/wiki/tensoes.test.ts`, escrito antes do código:

1. Proposta com tensão para uma candidata lida publica, guarda `tensoes` e acrescenta a ligação.
2. Os dois neurônios ficam `em_tensao`, e o lint marca `divergencias` nos dois.
3. A outra protegida aceita a tensão e não é republicada.
4. `outra.neuronioId` fora das candidatas lidas, igual ao alvo, ou `afirmacaoId` não visível descarta a proposta.
5. Retirar `minha` encerra a tensão. Retirar a afirmação do outro lado a tira da leitura e do estado.
6. Mudar a proposição de `minha` sem reconfirmar descarta a proposta.
7. A consulta do chat devolve as tensões e as divergências com os dois textos.
8. O teto de 10 e a deduplicação do par.

Também ajustar os testes que fixam a política (`rede-v5` → `rede-v6`) e o esquema da proposta. `banco.test.ts` cobre a gravação de `tensoes` (suíte de banco real, com usuários efêmeros).

## Arquivos tocados

`tipos.ts`, `automacao.ts` (esquema, validação e texto), `gerador.ts`, `editorial.ts`, `observabilidade.ts`, `consulta.ts`, `repositorio-de-notas/banco.ts`, `repositorio-de-notas/memoria.ts`, `components/wiki/NeuronioAberto.tsx` e o tipo do cérebro no cliente.

## Fora do escopo desta versão

- **Contradições que nunca aparecem juntas.** A descoberta só compara com até 8 candidatas lidas. Dois neurônios distantes que se contradizem não serão marcados. Uma segunda etapa poderia ter um lint pago sobre pares ligados, com orçamento próprio; ela só deve ser feita depois de medir quantas tensões a primeira etapa encontra.
- **Evento quando uma tensão some.** Hoje um par interno encerrado não gera evento. A tensão segue a mesma regra. As duas entram na lacuna 7 (remoções sem evento no Diário).
- **Tensão com uma proposta irmã** (`proposta:N`): fica de fora. Duas propostas da mesma resposta que se contradizem indicam proposta mal formada.

## Custo

Nenhuma chamada nova ao modelo. A saída cresce só quando há tensão. A entrada não muda: as candidatas já trazem as afirmações com id.
