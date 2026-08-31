import { CampoDeGrafoSvg } from "./implementacao-svg/CampoDeGrafoSvg";
import { GrafoInterativo } from "./implementacao-svg/GrafoInterativo";
import type { PropsDoCampoDeGrafo } from "./contrato";

export function CampoDeGrafo(props: PropsDoCampoDeGrafo) {
  if (props.modo === "interativo") {
    return (
      <>
        <CampoDeGrafoSvg {...props} />
        <GrafoInterativo
          nos={props.nos ?? []}
          arestas={props.arestas ?? []}
          noSelecionado={props.noSelecionado ?? null}
          aoSelecionarNo={props.aoSelecionarNo ?? (() => {})}
          posicoesIniciais={props.posicoesIniciais}
          aoAssentarLayout={props.aoAssentarLayout}
        />
      </>
    );
  }

  return <CampoDeGrafoSvg {...props} />;
}
