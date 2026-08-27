import { CampoDeGrafoSvg } from "./implementacao-svg/CampoDeGrafoSvg";
import type { PropsDoCampoDeGrafo } from "./contrato";

export function CampoDeGrafo(props: PropsDoCampoDeGrafo) {
  return <CampoDeGrafoSvg {...props} />;
}
