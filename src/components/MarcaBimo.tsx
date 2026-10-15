import Image from "next/image";
import marca from "@/assets/bimo-marca.svg";
import marcaPequena from "@/assets/bimo-marca-pequena.svg";

/**
 * A marca do Bimo — o grafo em forma de cérebro — como está no design system
 * (artifact "Bimo — Design System", grupo Logos). Os arquivos são usados como
 * vieram: o design system proíbe redesenhar ou recolorir a marca.
 *
 * Abaixo de 48px vale a versão "pequena" (menos nós, traço grosso), que é o
 * que header, chat e atalhos usam. O import estático faz o arquivo sair por
 * `/_next/static`, que o `proxy.ts` deixa passar — por isso a marca aparece
 * até na tela de login, antes de existir sessão.
 */
// Largura/altura do `viewBox` de cada arquivo. Fixas aqui (e não lidas do
// import) porque fora do Next — no Vitest — o import de SVG vira só uma string.
const PROPORCAO_MARCA = 208 / 184;
const PROPORCAO_MARCA_PEQUENA = 224 / 200;

/** A partir deste tamanho, a marca completa; abaixo, a simplificada. */
const TAMANHO_MINIMO_DA_MARCA = 48;

export default function MarcaBimo({ tamanho = 16 }: { tamanho?: number }) {
  const completa = tamanho >= TAMANHO_MINIMO_DA_MARCA;
  const arquivo = completa ? marca : marcaPequena;
  // A largura sai da proporção do próprio SVG, para nunca distorcer a marca.
  const largura = Math.round(tamanho * (completa ? PROPORCAO_MARCA : PROPORCAO_MARCA_PEQUENA));

  return (
    <Image
      src={arquivo}
      alt=""
      aria-hidden
      width={largura}
      height={tamanho}
      className="inline-block shrink-0 align-middle"
    />
  );
}
