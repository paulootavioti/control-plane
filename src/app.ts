import cors from "cors";
import express from "express";

import { authRoutes } from "./modules/auth/routes";
import { integracaoRoutes } from "./modules/integracao/routes";
import { provisionamentoRoutes } from "./modules/provisionamento/routes";
import { concessaoRoutes } from "./modules/concessao/routes";
import { assinantesRoutes } from "./modules/assinantes/routes";
import { planosRoutes } from "./modules/planos/routes";
import { faturasRoutes } from "./modules/faturas/routes";
import { auditoriaRoutes } from "./modules/auditoria/routes";
import { dashboardRoutes } from "./modules/dashboard/routes";
import { operadoresRoutes } from "./modules/operadores/routes";
import { assinaturasRoutes } from "./modules/assinaturas/routes";
import { contatosRoutes } from "./modules/contatos/routes";

export const app = express();

app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/integracao", integracaoRoutes);
app.use("/provisionamento", provisionamentoRoutes);
app.use("/concessoes", concessaoRoutes);
app.use("/assinantes", assinantesRoutes);
app.use("/planos", planosRoutes);
app.use("/faturas", faturasRoutes);
app.use("/auditoria", auditoriaRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/operadores", operadoresRoutes);
app.use("/assinaturas", assinaturasRoutes);
app.use("/contatos", contatosRoutes);

app.get("/health", (_request, response) => {
  response.status(200).json({
    service: "sysbelt-control-plane",
    status: "ok",
  });
});
