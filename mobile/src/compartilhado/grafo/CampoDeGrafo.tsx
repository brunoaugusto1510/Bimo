import { CampoDeGrafoSvg } from "./implementacao-svg/CampoDeGrafoSvg";
import { GrafoInterativo } from "./implementacao-svg/GrafoInterativo";
import type { PropsDoCampoDeGrafo } from "./contrato";

export function CampoDeGrafo(props: PropsDoCampoDeGrafo) {
  if (props.modo === "interativo") {
    // Sem o campo decorativo atrás: a tela de Nota já desenha o grafo real do
    // vault, e empilhar os dois significava ~240 elementos extras com
    // re-render a 30fps por baixo de tudo — era o que derrubava esta tela para
    // 9-10fps. O campo continua no Chat, onde é o fundo principal.
    return (
      <GrafoInterativo
        nos={props.nos ?? []}
        arestas={props.arestas ?? []}
        noSelecionado={props.noSelecionado ?? null}
        aoSelecionarNo={props.aoSelecionarNo ?? (() => {})}
        posicoesIniciais={props.posicoesIniciais}
        aoAssentarLayout={props.aoAssentarLayout}
      />
    );
  }

  return <CampoDeGrafoSvg {...props} />;
}
