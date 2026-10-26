import { describe, expect, it } from "vitest";
import { ROLES, canProvision, roleHome, type Role } from "@/lib/roles";

const actor = (role: Role, permissions: string[] = []) => ({ role, permissions });

describe("canProvision", () => {
  it("never allows creating a Super Admin in the app", () => {
    for (const role of ROLES) expect(canProvision(actor(role, ["operators.manage"]), "SUPER_ADMIN")).toBe(false);
  });

  it("lets only Super Admins create Admins", () => {
    expect(canProvision(actor("SUPER_ADMIN"), "ADMIN")).toBe(true);
    expect(canProvision(actor("ADMIN", ["operators.manage"]), "ADMIN")).toBe(false);
  });

  it("lets Admins create operators only with the permission", () => {
    expect(canProvision(actor("SUPER_ADMIN"), "OPERATOR")).toBe(true);
    expect(canProvision(actor("ADMIN"), "OPERATOR")).toBe(false);
    expect(canProvision(actor("ADMIN", ["operators.manage"]), "OPERATOR")).toBe(true);
  });

  it("lets staff, not operators or clients, create clients", () => {
    expect(canProvision(actor("SUPER_ADMIN"), "CLIENT")).toBe(true);
    expect(canProvision(actor("ADMIN"), "CLIENT")).toBe(true);
    expect(canProvision(actor("OPERATOR"), "CLIENT")).toBe(false);
    expect(canProvision(actor("CLIENT"), "CLIENT")).toBe(false);
  });

  it("does not trust a permission held by a non-admin", () => {
    expect(canProvision(actor("OPERATOR", ["operators.manage"]), "OPERATOR")).toBe(false);
  });
});

describe("roleHome", () => {
  it("routes each role to its area", () => {
    expect(roleHome("SUPER_ADMIN")).toBe("/admin");
    expect(roleHome("ADMIN")).toBe("/admin");
    expect(roleHome("OPERATOR")).toBe("/operator");
    expect(roleHome("CLIENT")).toBe("/client");
  });
});
