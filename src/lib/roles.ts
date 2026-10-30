export const ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATOR", "CLIENT"] as const;
export type Role = (typeof ROLES)[number];

/** Extra grants an Admin can hold. Super Admins implicitly hold all of them. */
export const PERMISSIONS = ["operators.manage"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const CAPABILITIES = ["CUTTING", "CNC", "EDGING"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  OPERATOR: "Operator",
  CLIENT: "Client",
};

export function roleHome(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "/admin";
    case "OPERATOR":
      return "/operator";
    case "CLIENT":
      return "/client";
  }
}

export function hasPermission(
  actor: { role: Role; permissions: readonly string[] },
  permission: Permission,
): boolean {
  return actor.role === "SUPER_ADMIN" || actor.permissions.includes(permission);
}

/**
 * Who may create (and later manage) an account of `target` role. Nobody can
 * create a Super Admin through the app; the first one comes from the
 * bootstrap script.
 */
export function canProvision(
  actor: { role: Role; permissions: readonly string[] },
  target: Role,
): boolean {
  switch (target) {
    case "SUPER_ADMIN":
      return false;
    case "ADMIN":
      return actor.role === "SUPER_ADMIN";
    case "OPERATOR":
      return (
        actor.role === "SUPER_ADMIN" ||
        (actor.role === "ADMIN" && hasPermission(actor, "operators.manage"))
      );
    case "CLIENT":
      return actor.role === "SUPER_ADMIN" || actor.role === "ADMIN";
  }
}
