import Image from "next/image";
import marca from "@/assets/bimo-marca.svg";
import marcaPequena from "@/assets/bimo-marca-pequena.svg";

/**
 * A marca do Bimo — um cérebro de perfil em grafo low-poly — como está no
 * design system (artifact "Bimo — Design System", grupo Logos). Os arquivos são
 * usados como vieram: redesenho ou cor nova só passam pelo design system.
 *
 * Abaixo de 48px vale a versão "pequena" (menos nós, traço grosso), que é o
 * que header, chat e atalhos usam. O import estático faz o arquivo sair por
 * `/_next/static`, que o `proxy.ts` deixa passar — por isso a marca aparece
 * até na tela de login, antes de existir sessão.
 */
// Largura/altura do `viewBox` de cada arquivo. Fixas aqui (e não lidas do
// import) porque fora do Next — no Vitest — o import de SVG vira só uma string.
// `MarcaBimo.test.tsx` lê o viewBox dos arquivos e falha se elas desalinharem.
const PROPORCAO_MARCA = 198 / 183;
const PROPORCAO_MARCA_PEQUENA = 204 / 193;

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
