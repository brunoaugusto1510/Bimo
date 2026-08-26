import { render, screen } from "@testing-library/react-native";
import Index from "./index";

describe("rota inicial", () => {
  it("renderiza a marca do app", async () => {
    await render(<Index />);
    expect(screen.getByText("Bimo")).toBeOnTheScreen();
  });
});
