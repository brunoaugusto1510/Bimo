// O projeto não tem @types/node, e um teste não justifica a dependência: o
// mínimo necessário é declarado aqui. Os caminhos são relativos à raiz de
// `mobile/`, que é de onde o Jest roda.
declare const require: (modulo: string) => { readFileSync: (caminho: string, codificacao: string) => string };

const { readFileSync } = require("fs");

// Este teste existe porque a mesma falha apareceu três vezes seguidas em
// aparelho e nenhuma delas foi pega pela suíte: uma função JS comum chamada de
// dentro de um worklet derruba a tela com "Tried to synchronously call a Remote
// Function". Em teste isso nunca aparece — o mock do Reanimated roda tudo no
// mesmo runtime de JS, onde a chamada é perfeitamente válida.
//
// A verificação é de fonte, não de comportamento: dado que a diretiva é a
// única coisa que separa os dois mundos, e que ela some sem quebrar nada
// visível, vale travá-la por escrito. Ao acrescentar uma função que roda na UI
// (gesto, useAnimatedStyle, useAnimatedProps, useFrameCallback), inclua-a aqui.
const ESPERADAS: Record<string, string[]> = {
  "src/compartilhado/grafo/posicionamento.ts": ["raioDoNo", "paraCoordenadaDoGrafo", "noMaisProximoDeCoordenada"],
  "src/compartilhado/grafo/simulacao.ts": ["avancarSimulacao", "fixarNo", "liberarNo", "reaquecer", "esfriou"],
  "src/funcionalidades/vault/alturaDaFolha.ts": ["proximaAltura", "alturaMedia", "alternarAltura"],
  // fisica.ts ficou de fora na primeira versão desta lista, e foi exatamente
  // por onde a falha voltou: `avancarCampoEmLugar` chamava `raioDoCampo`, que
  // não era worklet, e a tela morria ao recarregar.
  "src/compartilhado/grafo/fisica.ts": [
    "raioDoCampo",
    "avancarCampoEmLugar",
    "avancarParticulasEmLugar",
    "opacidadeDaParticula",
    "deveRecalcularLigacoes",
  ],
};

function corpoDaFuncao(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`export function ${nome}(`);
  if (inicio === -1) throw new Error(`função ${nome} não encontrada`);
  const abertura = fonte.indexOf("{", inicio);
  return fonte.slice(abertura, abertura + 200);
}

describe("funções que rodam na UI levam a diretiva worklet", () => {
  for (const [arquivo, funcoes] of Object.entries(ESPERADAS)) {
    describe(arquivo, () => {
      const fonte = readFileSync(arquivo, "utf8");

      for (const nome of funcoes) {
        it(`${nome} é worklet`, () => {
          expect(corpoDaFuncao(fonte, nome)).toContain('"worklet"');
        });
      }
    });
  }
});
