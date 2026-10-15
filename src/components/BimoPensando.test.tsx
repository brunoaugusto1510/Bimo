import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BimoPensando from "./BimoPensando";

describe("BimoPensando", () => {
  it("anuncia o estado como status, com o texto padrão", () => {
    render(<BimoPensando />);

    expect(screen.getByRole("status")).toHaveTextContent("Pensando…");
  });

  it("mostra o texto recebido — o grafo sozinho não comunica o estado", () => {
    render(<BimoPensando texto="Procurando ligações…" />);

    expect(screen.getByRole("status")).toHaveTextContent("Procurando ligações…");
  });
});
