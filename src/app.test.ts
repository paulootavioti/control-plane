import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "./app";

describe("GET /health", () => {
  it("confia no proxy da hospedagem para identificar o IP original", () => {
    expect(app.get("trust proxy")).toBe(1);
  });

  it("identifica o serviço independente do Control Plane", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: "sysbelt-control-plane",
      status: "ok",
    });
  });

  it("aceita mesma origem e rejeita origem cruzada não autorizada", async () => {
    const mesmaOrigem = await request(app).get("/health")
      .set("host", "control.example.com")
      .set("x-forwarded-proto", "https")
      .set("origin", "https://control.example.com");
    expect(mesmaOrigem.status).toBe(200);
    expect(mesmaOrigem.headers["access-control-allow-origin"]).toBe("https://control.example.com");

    const cruzada = await request(app).get("/health")
      .set("host", "control.example.com")
      .set("origin", "https://malicioso.example");
    expect(cruzada.status).toBe(403);
    expect(cruzada.body).toEqual({ codigo: "ORIGEM_NAO_PERMITIDA" });
    expect(cruzada.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responde ao preflight autorizado sem habilitar credenciais de navegador", async () => {
    const response = await request(app).options("/auth/login")
      .set("host", "control.example.com")
      .set("x-forwarded-proto", "https")
      .set("origin", "https://control.example.com")
      .set("access-control-request-method", "POST")
      .set("access-control-request-headers", "content-type");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://control.example.com");
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
