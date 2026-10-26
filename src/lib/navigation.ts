import {
  Briefcase01Icon,
  DashboardSquare01Icon,
  WorkHistoryIcon,
  ListViewIcon,
  IdentityCardIcon,
  Layers01Icon,
  Note01Icon,
  Task01Icon,
  UserGroupIcon,
  UserShield01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { hasPermission, type Permission, type Role } from "@/lib/roles";

export type NavIcon = typeof DashboardSquare01Icon;
export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavSection = { title?: string; items: NavItem[] };

/**
 * Sidebar entries per role. Only pages that exist are listed; later phases add
 * queues, cutlists, reports and the rest.
 */
export function navigationFor(user: { role: Role; permissions: readonly Permission[] }): NavSection[] {
  switch (user.role) {
    case "SUPER_ADMIN":
    case "ADMIN": {
      const people: NavItem[] = [{ href: "/admin/clients", label: "Clients", icon: UserGroupIcon }];
      if (hasPermission(user, "operators.manage")) {
        people.push({ href: "/admin/operators", label: "Operators", icon: Wrench01Icon });
      }
      if (user.role === "SUPER_ADMIN") {
        people.push({ href: "/admin/admins", label: "Administrators", icon: UserShield01Icon });
      }
      const sections: NavSection[] = [
        { items: [{ href: "/admin", label: "Overview", icon: DashboardSquare01Icon }] },
        {
          title: "Production",
          items: [
            { href: "/admin/jobs", label: "Jobs", icon: Briefcase01Icon },
            { href: "/admin/queues", label: "Queues", icon: ListViewIcon },
            { href: "/admin/materials", label: "Materials", icon: Layers01Icon },
          ],
        },
        { title: "People", items: people },
      ];
      if (user.role === "SUPER_ADMIN") {
        sections.push({ title: "Oversight", items: [{ href: "/admin/audit", label: "Audit log", icon: Note01Icon }] });
      }
      return sections;
    }
    case "OPERATOR":
      return [
        {
          items: [
            { href: "/operator", label: "My queue", icon: Task01Icon },
            { href: "/operator/history", label: "History", icon: WorkHistoryIcon },
          ],
        },
      ];
    case "CLIENT":
      return [
        {
          items: [
            { href: "/client", label: "My jobs", icon: Briefcase01Icon },
            { href: "/client/card", label: "My card", icon: IdentityCardIcon },
          ],
        },
      ];
  }
}
