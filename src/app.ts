import cors from "cors";
import express from "express";

export const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.status(200).json({
    service: "sysbelt-control-plane",
    status: "ok",
  });
});
