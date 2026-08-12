import cors from "cors";
import express from "express";

import { authRoutes } from "./modules/auth/routes";

export const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);

app.get("/health", (_request, response) => {
  response.status(200).json({
    service: "sysbelt-control-plane",
    status: "ok",
  });
});
