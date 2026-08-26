import { render, screen } from "@testing-library/react-native";
import Inicio from "./index";

describe("rota inicial", () => {
  it("renderiza a marca do app", async () => {
    await render(<Inicio />);
    expect(screen.getByText("Bimo")).toBeOnTheScreen();
  });
});
