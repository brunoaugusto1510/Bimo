import { defaultExclude, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Config do Vitest para o projeto.
 *
 * `jsdom` como ambiente padrão: serve tanto para as funções puras de
 * `src/lib/` (não usam nada do DOM, então o jsdom é transparente) quanto para
 * os componentes React que precisam de `document`/eventos. Evita ter que
 * marcar `// @vitest-environment` arquivo por arquivo.
 *
 * `vite-tsconfig-paths` resolve o alias "@/*" -> "src/*" a partir do
 * `tsconfig.json`, sem duplicar essa configuração aqui.
 *
 * `mobile/` é o app Expo, que roda no Jest dele mesmo e depende do
 * `mobile/node_modules` (não instalado aqui) — fica fora do escopo do
 * Vitest da web.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    exclude: [...defaultExclude, "mobile/**", "etapas-futuras/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // etapas-futuras/ não é código em execução (é referência de design) —
      // não faz sentido cobrar cobertura dele.
      exclude: ["etapas-futuras/**", "node_modules/**", ".next/**"],
    },
  },
});
