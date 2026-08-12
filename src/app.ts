import cors from "cors";
import express from "express";

import { authRoutes } from "./modules/auth/routes";
import { integracaoRoutes } from "./modules/integracao/routes";

export const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/integracao", integracaoRoutes);

app.get("/health", (_request, response) => {
  response.status(200).json({
    service: "sysbelt-control-plane",
    status: "ok",
  });
});
