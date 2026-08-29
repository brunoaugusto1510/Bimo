import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { ProvedorDeServicos, type Servicos } from "@/servicos";
import { servicoVaultFake } from "@/servicos/fake/servicoVaultFake";
import { notas } from "@/dados/fixtures/notas";
import { Editor } from "./Editor";
import { useEstadoEditor } from "./estado";

const mockBack = jest.fn();
// `mockIdAtual` é mutável de propósito: o teste de nota obsoleta (mais
// abaixo) precisa que `useLocalSearchParams` devolva um `id` diferente
// depois de um `rerender`, simulando o usuário fechar uma nota e abrir
// outra sem que o Editor.tsx mude. O prefixo `mock` é obrigatório — é a
// única forma de `jest.mock()` (hoisted pelo Babel) referenciar uma
// variável fora do seu próprio escopo (`babel-plugin-jest-hoist` só libera
// identificadores começando com `mock`), o mesmo motivo de `mockBack` já
// existir com esse nome.
let mockIdAtual = notas[0].id;
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockIdAtual }),
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
// para escapar de uma corrida (essas são corrigidas em estado.ts/Editor.tsx:
// ver os describes "corrida..." mais abaixo, que interagem ANTES do
// carregamento terminar de propósito e passam mesmo assim), só para que os
// testes que fazem asserção síncrona logo em seguida (`getByDisplayValue`
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
    mockIdAtual = notas[0].id;
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

  describe("corrida entre o carregamento da nota e uma ação rápida do usuário", () => {
    it("desabilita o gatilho da IA até a nota real carregar, e reabilita depois", async () => {
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

      // Rodar uma ação da IA contra o casco vazio (sem o conteúdo real da
      // nota) produziria uma sugestão sem sentido — "resumir" uma nota sem
      // corpo. Por isso o gatilho fica desabilitado enquanto o fetch está
      // no ar, não só a sugestão protegida depois que ela chega.
      const botaoBimo = await screen.findByRole("button", { name: "Bimo" });
      expect(botaoBimo).toBeDisabled();

      resolverCarregamento(notas[0]);
      await screen.findByDisplayValue(notas[0].titulo);

      expect(botaoBimo).not.toBeDisabled();
    });

    // Reproduz de verdade o achado do agente anterior, na parte que o fix
    // round 1 não cobria: o corpo da nota (não só a sugestão) é interativo
    // desde o primeiro paint. Diferente de renderizar(), este teste NÃO
    // espera o título carregar antes de interagir.
    it("preserva o texto digitado quando a nota termina de carregar depois", async () => {
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

      const campoDeCorpo = await screen.findByPlaceholderText("Comece a escrever...");
      await fireEvent.changeText(campoDeCorpo, "Rascunho que o usuário já está digitando");

      // Só agora o carregamento (mais lento) da nota real termina.
      resolverCarregamento(notas[0]);
      await screen.findByDisplayValue(notas[0].titulo);

      expect(screen.getByDisplayValue("Rascunho que o usuário já está digitando")).toBeOnTheScreen();
    });

    it("preserva o cartão de sugestão quando a nota termina de carregar quase junto com uma ação disparada logo que o gatilho libera", async () => {
      let resolverCarregamento: (nota: (typeof notas)[number]) => void = () => {};
      const carregamentoControlado = new Promise<(typeof notas)[number]>((resolve) => {
        resolverCarregamento = resolve;
      });
      const servicosComCarregamentoLento: Servicos = {
        ...servicos,
        vault: { ...servicoVaultFake, obterNota: () => carregamentoControlado },
      };

      // A ação da IA só é disparável depois que a nota carrega (ver o teste
      // do gatilho desabilitado acima). Este teste resolve o carregamento e
      // dispara a ação em seguida — o `aplicarConteudo`/`setNotaCarregada`
      // do efeito e o `rodarAcao` do clique correm quase ao mesmo tempo —
      // para provar que a store protege sugestao/menuIA mesmo nessa borda.
      await render(
        <ProvedorDeTema>
          <ProvedorDeServicos servicos={servicosComCarregamentoLento}>
            <Editor />
          </ProvedorDeServicos>
        </ProvedorDeTema>,
      );

      resolverCarregamento(notas[0]);
      await fireEvent.press(await screen.findByRole("button", { name: "Bimo" }));
      await fireEvent.press(await screen.findByRole("button", { name: "Continuar escrevendo" }));
      expect(await screen.findByText(/Sugestão do Bimo/)).toBeOnTheScreen();
    });
  });

  describe("falha no carregamento da nota", () => {
    // Cobre o achado do review: `obterNota` rejeitando não pode ser engolido
    // em silêncio. Sem UI de erro nesta fase (fora de escopo), o mínimo
    // honesto é logar — e é só isso que dá para afirmar com segurança sobre
    // o gatilho da IA aqui: como `notaCarregada` só é preenchido no caminho
    // de sucesso, uma rejeição o deixa desabilitado *para sempre*, do mesmo
    // jeito que já ficava desabilitado enquanto o fetch estava em voo. Este
    // teste não afirma que o gatilho "volta a ficar habilitado" — isso
    // seria falso — só que a tela não quebra e que a falha chega ao log.
    it("não derruba a tela e loga a falha em vez de engolir a rejeição, mantendo o gatilho desabilitado", async () => {
      const consoleErroEspiao = jest.spyOn(console, "error").mockImplementation(() => {});
      const erroDeRede = new Error("rede fora do ar");
      const servicosComFalha: Servicos = {
        ...servicos,
        vault: { ...servicoVaultFake, obterNota: () => Promise.reject(erroDeRede) },
      };

      await render(
        <ProvedorDeTema>
          <ProvedorDeServicos servicos={servicosComFalha}>
            <Editor />
          </ProvedorDeServicos>
        </ProvedorDeTema>,
      );

      const botaoBimo = await screen.findByRole("button", { name: "Bimo" });
      expect(botaoBimo).toBeDisabled();

      await waitFor(() => expect(consoleErroEspiao).toHaveBeenCalled());
      const [contexto, erroRecebido] = consoleErroEspiao.mock.calls[0];
      expect(String(contexto)).toMatch(/nota/i);
      expect(erroRecebido).toBe(erroDeRede);

      // A tela segue de pé e o gatilho continua desabilitado — não há
      // reabilitação possível sem um novo fetch, que está fora de escopo.
      expect(botaoBimo).toBeDisabled();

      consoleErroEspiao.mockRestore();
    });
  });

  describe("resposta obsoleta de uma nota fechada antes de trocar para outra", () => {
    // Reproduz o cenário exato do review: abrir o editor de A, o fetch de A
    // fica em voo, o usuário fecha e abre a nota B antes dele responder — e
    // só depois disso o fetch de A, mais lento, termina. O conteúdo de A
    // não pode vazar para a tela que já mostra B.
    it("não deixa o conteúdo de A vazar para a tela quando B já foi aberta", async () => {
      let resolverA: (nota: (typeof notas)[number]) => void = () => {};
      const fetchA = new Promise<(typeof notas)[number]>((resolve) => {
        resolverA = resolve;
      });
      const servicosControlados: Servicos = {
        ...servicos,
        vault: {
          ...servicoVaultFake,
          obterNota: (id) => (id === notas[0].id ? fetchA : Promise.resolve(notas[1])),
        },
      };

      mockIdAtual = notas[0].id;
      const { rerender } = await render(
        <ProvedorDeTema>
          <ProvedorDeServicos servicos={servicosControlados}>
            <Editor />
          </ProvedorDeServicos>
        </ProvedorDeTema>,
      );

      // o usuário fecha a nota A (o fetch dela continua em voo) e abre B.
      mockIdAtual = notas[1].id;
      await rerender(
        <ProvedorDeTema>
          <ProvedorDeServicos servicos={servicosControlados}>
            <Editor />
          </ProvedorDeServicos>
        </ProvedorDeTema>,
      );
      await screen.findByDisplayValue(notas[1].titulo);

      // só agora o fetch de A, mais lento, termina.
      resolverA(notas[0]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screen.getByDisplayValue(notas[1].titulo)).toBeOnTheScreen();
      expect(screen.queryByDisplayValue(notas[0].titulo)).toBeNull();
    });
  });
});
