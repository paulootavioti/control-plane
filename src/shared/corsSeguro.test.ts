import { describe, expect, it } from "vitest";
import { origemCorsPermitida, origensCorsConfiguradas } from "./corsSeguro";

describe("política CORS", () => {
  it("aceita a mesma origem e uma allowlist HTTPS explícita", () => {
    const ambiente = { CONTROL_PLANE_CORS_ORIGINS: "https://admin.example.com, https://suporte.example.com" };
    expect(origemCorsPermitida("https://control.example.com", "https://control.example.com", ambiente)).toBe(true);
    expect(origemCorsPermitida("https://admin.example.com", "https://control.example.com", ambiente)).toBe(true);
    expect(origemCorsPermitida("https://malicioso.example", "https://control.example.com", ambiente)).toBe(false);
  });

  it("ignora origens inseguras, com caminho ou credenciais", () => {
    const resultado = origensCorsConfiguradas({
      CONTROL_PLANE_CORS_ORIGINS: "http://externo.example,https://example.com/caminho,https://usuario:senha@example.com",
    });
    expect(resultado.size).toBe(0);
  });

  it("libera o proxy local apenas em desenvolvimento", () => {
    expect(origensCorsConfiguradas({ NODE_ENV: "development" }).has("http://localhost:5177")).toBe(true);
    expect(origensCorsConfiguradas({ NODE_ENV: "production" }).has("http://localhost:5177")).toBe(false);
  });
});
