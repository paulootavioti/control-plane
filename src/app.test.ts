import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "./app";

describe("GET /health", () => {
  it("confia no proxy da hospedagem para identificar o IP original", () => {
    expect(app.get("trust proxy")).toBe(true);
  });

  it("identifica o serviço independente do Control Plane", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: "sysbelt-control-plane",
      status: "ok",
    });
  });
});
