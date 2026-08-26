import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Só as funções puras (regras de negócio, parsing, datas). Nada aqui
    // toca banco, rede ou React -- é o pedaço do sistema que dá para travar
    // com teste barato e rápido.
    include: ["testes/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
