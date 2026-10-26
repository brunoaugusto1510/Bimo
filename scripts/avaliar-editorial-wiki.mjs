// Gera dois executores isolados. Dados e resultados brutos ficam somente em .vercel (ignorado).
import { build } from "esbuild";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve, relative } from "node:path";
import { mkdir } from "node:fs/promises";
import ambiente from "@next/env";
const reproduzir = process.argv.includes("--reproduzir");
if (!process.argv.includes("--executar") && !reproduzir) throw new Error("Informe --executar para chamadas pagas ou --reproduzir para reprodução local.");
if (!reproduzir) ambiente.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const pasta = ".vercel/avaliacao-editorial";
const baseAnterior = "2e4249f2432a7ce936f4edbd15a1e540c9cf80b9";
await mkdir(pasta, { recursive: true });
const politicas = process.env.POLITICA_WIKI ? [process.env.POLITICA_WIKI] : ["anterior", "candidata"];
for (const politica of politicas) {
  if (!["anterior", "candidata"].includes(politica)) throw new Error("Política inválida.");
  const rotulo = process.env.RODADA_AVALIACAO || politica;
  if (!/^[a-z0-9-]{1,40}$/.test(rotulo)) throw new Error("Rótulo de avaliação inválido.");
  const saida = resolve(pasta, `${politica}.mjs`);
  await build({ entryPoints: ["scripts/avaliacao-wiki/executar.ts"], outfile: saida,
    bundle: true, platform: "node", format: "esm", packages: "external", define: {
      POLITICA_DA_AVALIACAO: JSON.stringify(rotulo), BASE_DA_AVALIACAO: JSON.stringify(baseAnterior),
    },
    plugins: [{ name: "amostra-isolada", setup(b) {
      b.onResolve({ filter: /^server-only$/ }, () => ({ path: "vazio", namespace: "amostra" }));
      b.onLoad({ filter: /.*/, namespace: "amostra" }, () => ({ contents: "export {};" }));
      if (politica === "anterior") b.onLoad({ filter: /[\\/]wiki[\\/](automacao|gerador)\.ts$/ }, (args) => ({
        contents: execFileSync("git", ["show", `${baseAnterior}:${relative(process.cwd(), args.path).replaceAll("\\", "/")}`], { encoding: "utf8" }), loader: "ts", resolveDir: resolve(args.path, ".."),
      }));
    } }] });
  // O ambiente só é herdado pelo processo filho; valores não são exibidos ou gravados no relatório.
  const resultado = spawnSync(process.execPath, [saida, reproduzir ? "--reproduzir" : "--executar"], { stdio: "inherit", env: process.env });
  if (resultado.status !== 0) throw new Error("A avaliação foi interrompida; resultados parciais preservados para retomada.");
}
