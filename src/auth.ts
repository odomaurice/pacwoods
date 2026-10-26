import NextAuth, { CredentialsSignin, type User as AuthUser } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { parseIdentifier } from "@/lib/identity";
import { signInSchema } from "@/lib/password-policy";
import type { Capability, Permission, Role } from "@/lib/roles";
import { dummyPasswordHash, verifyPassword } from "@/server/auth/password";
import {
  LOGIN_LIMIT_PER_ACCOUNT,
  LOGIN_LIMIT_PER_IP,
  clear,
  hit,
  peek,
} from "@/server/auth/throttle";
import { connectDb } from "@/server/db/connect";
import { User } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";

declare module "next-auth" {
  interface User {
    role: Role;
    permissions: Permission[];
    capabilities: Capability[];
    mustChangePassword: boolean;
    sessionVersion: number;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      role: Role;
      permissions: Permission[];
      capabilities: Capability[];
      mustChangePassword: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    permissions: Permission[];
    capabilities: Capability[];
    mustChangePassword: boolean;
    sessionVersion: number;
  }
}

/** Shown for every failure, so the form does not reveal which accounts exist. */
class InvalidCredentials extends CredentialsSignin {
  code = "invalid";
}
class TooManyAttempts extends CredentialsSignin {
  code = "throttled";
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function authorize(raw: unknown, request: Request): Promise<AuthUser> {
  const parsed = signInSchema.safeParse(raw);
  const identifier = parsed.success ? parseIdentifier(parsed.data.identifier) : null;
  if (!parsed.success || !identifier) throw new InvalidCredentials();

  await connectDb();
  const ip = clientIp(request);
  const accountKey = `login:${identifier.kind}:${identifier.value}`;

  if (
    (await hit(`login:ip:${ip}`)) > LOGIN_LIMIT_PER_IP ||
    (await peek(accountKey)) >= LOGIN_LIMIT_PER_ACCOUNT
  ) {
    throw new TooManyAttempts();
  }

  const user = await User.findOne({ [identifier.kind]: identifier.value }).select(
    "+passwordHash",
  );
  const ok = await verifyPassword(
    user?.passwordHash ?? (await dummyPasswordHash()),
    parsed.data.password,
  );

  if (!user || !ok || user.status !== "ACTIVE") {
    await hit(accountKey);
    await audit({
      action: "auth.login_failed",
      targetType: "User",
      targetId: user?._id,
      meta: { reason: !user ? "unknown" : !ok ? "password" : user.status },
      ip,
    });
    throw new InvalidCredentials();
  }

  await clear(accountKey);
  user.lastLoginAt = new Date();
  await user.save();
  await audit({ actorId: user._id, action: "auth.login", targetType: "User", targetId: user._id, ip });

  return {
    id: user._id.toString(),
    name: user.name,
    role: user.role,
    // Plain arrays: Auth.js structured-clones this object, and Mongoose arrays cannot be cloned.
    permissions: [...user.permissions] as Permission[],
    capabilities: [...user.capabilities] as Capability[],
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { identifier: {}, password: {} },
      authorize,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          uid: user.id!,
          role: user.role,
          permissions: user.permissions,
          capabilities: user.capabilities,
          mustChangePassword: user.mustChangePassword,
          sessionVersion: user.sessionVersion,
        };
      }

      // Re-check on every request so suspension, role changes and "sign out
      // everywhere" apply immediately rather than when the token expires.
      await connectDb();
      const current = await User.findById(token.uid)
        .select("role permissions capabilities status mustChangePassword sessionVersion")
        .lean();
      if (
        !current ||
        current.status !== "ACTIVE" ||
        current.sessionVersion !== token.sessionVersion
      ) {
        return null;
      }
      return {
        ...token,
        role: current.role,
        permissions: current.permissions as Permission[],
        capabilities: current.capabilities as Capability[],
        mustChangePassword: current.mustChangePassword,
      };
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.uid,
        name: token.name ?? "",
        role: token.role,
        permissions: token.permissions,
        capabilities: token.capabilities,
        mustChangePassword: token.mustChangePassword,
      };
      return session;
    },
  },
});
