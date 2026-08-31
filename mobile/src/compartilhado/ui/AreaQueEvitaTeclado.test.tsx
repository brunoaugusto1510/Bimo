import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { AreaQueEvitaTeclado, alturaCobertaPeloTeclado } from "./AreaQueEvitaTeclado";

async function renderizar(style: object = { flex: 1 }) {
  return render(
    <AreaQueEvitaTeclado style={style}>
      <Text>miolo</Text>
    </AreaQueEvitaTeclado>,
  );
}

describe("alturaCobertaPeloTeclado", () => {
  it("mede pela borda reportada quando ela cobre mais que a altura reportada", () => {
    // Area termina em 2200; topo do teclado em 1300 => 900 de sobreposicao,
    // maior que os 800 de altura reportada.
    expect(alturaCobertaPeloTeclado({ fundoDaArea: 2200, topoDoTeclado: 1300, alturaDoTeclado: 800 })).toBe(900);
  });

  // Este e o caso do Android com a faixa de sugestoes aberta: o `screenY` marca
  // o topo do IME sem a faixa, entao a conta por borda devolve de menos. A
  // altura reportada vem de `WindowInsetsCompat.Type.ime()`, que conta a janela
  // do IME inteira — faixa incluida — e por isso ganha aqui.
  it("mede pela altura reportada quando a borda reportada devolve de menos", () => {
    expect(alturaCobertaPeloTeclado({ fundoDaArea: 2200, topoDoTeclado: 1400, alturaDoTeclado: 950 })).toBe(950);
  });

  it("nao recua quando o teclado esta fechado", () => {
    expect(alturaCobertaPeloTeclado({ fundoDaArea: 2200, topoDoTeclado: 2200, alturaDoTeclado: 0 })).toBe(0);
  });

  it("nao devolve negativo", () => {
    expect(alturaCobertaPeloTeclado({ fundoDaArea: 0, topoDoTeclado: 1300, alturaDoTeclado: 0 })).toBe(0);
  });
});

describe("AreaQueEvitaTeclado", () => {
  it("desenha o conteudo", async () => {
    await renderizar();
    expect(screen.getByText("miolo")).toBeOnTheScreen();
  });

  // Com o teclado fechado o recuo e zero, mas a chave tem que existir: e ela
  // que o `keyboardDidShow` passa a preencher. Um `paddingBottom` numerico aqui
  // e o que prova que a area esta ligada no teclado.
  it("reserva o recuo do teclado, zerado enquanto ele esta fechado", async () => {
    await renderizar();
    const area = screen.getByTestId("area-que-evita-o-teclado");
    const estilo = StyleSheet.flatten(area.props.style) as { paddingBottom?: number };
    expect(estilo.paddingBottom).toBe(0);
  });

  it("repassa o estilo recebido para a caixa externa", async () => {
    await renderizar({ flex: 1, backgroundColor: "#123456" });
    const externa = screen.getByTestId("caixa-que-evita-o-teclado");
    const estilo = StyleSheet.flatten(externa.props.style) as { backgroundColor?: string };
    expect(estilo.backgroundColor).toBe("#123456");
  });
});
