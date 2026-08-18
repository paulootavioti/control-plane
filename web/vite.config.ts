import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 5177 — as outras portas já estão tomadas: 5173 sgcl-web, 5175 Portal da
// Família, 5176 Portal do Professor.
//
// Em produção este app é servido pelo MESMO site do Control Plane, então as
// chamadas vão para /api na própria origem e não há CORS envolvido. Em
// desenvolvimento, o proxy abaixo reproduz esse arranjo apontando para a API
// local (porta 3334), onde as rotas ficam na raiz — o prefixo /api só existe
// em produção, criado pelo wrapper serverless.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    proxy: {
      "/api": {
        target: "http://localhost:3334",
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/api/, ""),
      },
    },
  },
});
