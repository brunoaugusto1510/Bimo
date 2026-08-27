import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { ProvedorDeServicos, type Servicos } from "@/servicos";
import { servicoVaultFake } from "@/servicos/fake/servicoVaultFake";
import { notas } from "@/dados/fixtures/notas";
import { Editor } from "./Editor";
import { useEstadoEditor } from "./estado";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: (require("@/dados/fixtures/notas").notas as typeof notas)[0].id }),
}));

// O `ServicoIA` padrão (servicoIaFake) tem um atraso real de 900ms em
// acaoNaNota — perto demais do timeout padrão de 1000ms do findBy/waitFor
// da RNTL, o que deixaria este arquivo intermitente. Como nenhum teste
// aqui verifica o conteúdo exato da sugestão (só que o cartão aparece e
// que "Inserir" some com ele), uma resposta imediata preserva o
// comportamento sob teste sem a corrida contra o relógio.
const servicos: Servicos = {
  vault: servicoVaultFake,
  ia: {
    conversar: async () => ({ texto: "", cartoes: [] }),
    acaoNaNota: async (tipo) => ({ tipo, rotulo: `Rótulo de ${tipo}`, texto: "Texto sugerido." }),
  },
};

// Espera o título carregado antes de cada teste começar a interagir — não é
// mais para escapar de uma corrida (essa foi corrigida em estado.ts/
// Editor.tsx: ver o describe "corrida..." mais abaixo, que interage ANTES
// do carregamento terminar de propósito e passa mesmo assim), só para que
// os testes que fazem asserção síncrona logo em seguida (`getByDisplayValue`
// em vez de `findBy...`) tenham a tela já estável.
async function renderizar() {
  const resultado = await render(
    <ProvedorDeTema>
      <ProvedorDeServicos servicos={servicos}>
        <Editor />
      </ProvedorDeServicos>
    </ProvedorDeTema>,
  );
  await screen.findByDisplayValue(notas[0].titulo);
  return resultado;
}

describe("Editor", () => {
  beforeEach(() => {
    mockBack.mockClear();
    useEstadoEditor.getState().resetar();
  });

  it("mostra o título e a pasta da nota", async () => {
    await renderizar();
    expect(screen.getByDisplayValue(notas[0].titulo)).toBeOnTheScreen();
    expect(screen.getByText(notas[0].pasta)).toBeOnTheScreen();
  });

  it("volta pelo arrow_back", async () => {
    await renderizar();
    await fireEvent.press(await screen.findByRole("button", { name: "Voltar" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("abre o menu de ações da IA com as cinco opções", async () => {
    await renderizar();
    await fireEvent.press(await screen.findByRole("button", { name: "Bimo" }));
    expect(await screen.findByText("BIMO NESTA NOTA")).toBeOnTheScreen();
    for (const rotulo of ["Sugerir links", "Resumir a nota", "Extrair tags", "Continuar escrevendo", "Perguntar sobre a nota"]) {
      expect(screen.getByRole("button", { name: rotulo })).toBeOnTheScreen();
    }
  });

  it("mostra o cartão de sugestão depois de rodar uma ação", async () => {
    await renderizar();
    await fireEvent.press(await screen.findByRole("button", { name: "Bimo" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Resumir a nota" }));
    expect(await screen.findByText(/Sugestão do Bimo/)).toBeOnTheScreen();
  });

  it("insere a sugestão no corpo", async () => {
    await renderizar();
    await fireEvent.press(await screen.findByRole("button", { name: "Bimo" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Continuar escrevendo" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Inserir" }));
    await waitFor(() => expect(screen.queryByText(/Sugestão do Bimo/)).toBeNull());
  });

  it("mostra o rodapé de status do grafo", async () => {
    await renderizar();
    expect(await screen.findByText("O grafo acompanha o que você escreve")).toBeOnTheScreen();
  });

  describe("corrida entre o carregamento da nota e uma ação rápida da IA", () => {
    // Reproduz de verdade o achado do agente anterior: o carregamento da
    // nota (vault.obterNota) ainda não respondeu quando o usuário já roda
    // uma ação da IA. Diferente de renderizar(), este teste NÃO espera o
    // título carregar antes de interagir — é exatamente essa interação
    // rápida, contra um carregamento controlado manualmente, que expõe a
    // corrida se ela voltar. Ver o comentário em estado.ts (carregar()) e
    // Editor.tsx (o "casco" síncrono) para a correção.
    it("preserva o cartão de sugestão quando a nota termina de carregar depois", async () => {
      let resolverCarregamento: (nota: (typeof notas)[number]) => void = () => {};
      const carregamentoControlado = new Promise<(typeof notas)[number]>((resolve) => {
        resolverCarregamento = resolve;
      });
      const servicosComCarregamentoLento: Servicos = {
        ...servicos,
        vault: { ...servicoVaultFake, obterNota: () => carregamentoControlado },
      };

      await render(
        <ProvedorDeTema>
          <ProvedorDeServicos servicos={servicosComCarregamentoLento}>
            <Editor />
          </ProvedorDeServicos>
        </ProvedorDeTema>,
      );

      // A nota real ainda não chegou (a promessa acima só resolve quando
      // chamarmos resolverCarregamento), mas o botão "Bimo" já está na tela
      // desde o primeiro render — o usuário consegue tocar nele antes disso.
      await fireEvent.press(await screen.findByRole("button", { name: "Bimo" }));
      await fireEvent.press(await screen.findByRole("button", { name: "Continuar escrevendo" }));
      expect(await screen.findByText(/Sugestão do Bimo/)).toBeOnTheScreen();

      // Só agora o carregamento (mais lento) da nota real termina.
      resolverCarregamento(notas[0]);
      await screen.findByDisplayValue(notas[0].titulo);

      // A sugestão que chegou durante a espera não pode ter sido apagada
      // quando os dados reais da nota chegaram.
      expect(screen.getByText(/Sugestão do Bimo/)).toBeOnTheScreen();
    });
  });
});
