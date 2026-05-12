import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // server-only throws in non-Next.js environments; shim it for tests
      "server-only": path.resolve(__dirname, "vitest-mocks/server-only.ts"),
    },
  },
})
