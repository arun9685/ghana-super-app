import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/modules/auth/jwt.service";

// Unit test (spec §50, "Unit tests: Business logic") — no DB or Redis
// needed, so this one runs anywhere `vitest run` runs, including CI
// before any infrastructure is provisioned.
describe("JWT access tokens", () => {
  it("round-trips a valid token", () => {
    const token = signAccessToken("user-123", ["CUSTOMER"]);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-123");
    expect(payload.roles).toEqual(["CUSTOMER"]);
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken("user-123", ["CUSTOMER"]);
    const tampered = token.slice(0, -2) + "xx";
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
