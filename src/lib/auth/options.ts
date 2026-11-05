import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateUser } from "../../modules/users/service";
import { measure } from "../observability/request";
import { safeReturnPath } from "../http/input";

if (
  !process.env.NEXTAUTH_SECRET ||
  process.env.NEXTAUTH_SECRET === "replace_with_random_local_secret" ||
  process.env.NEXTAUTH_SECRET.length < 32
)
  throw new Error(
    "Configura NEXTAUTH_SECRET con un secreto aleatorio local de al menos 32 bytes.",
  );

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/iniciar-sesion", error: "/iniciar-sesion" },
  providers: [
    Credentials({
      name: "Correo y contraseña",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize: (credentials) =>
        measure("auth", () =>
          authenticateUser(credentials?.email, credentials?.password),
        ),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
    async redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        return target.origin === new URL(baseUrl).origin
          ? new URL(
              safeReturnPath(
                `${target.pathname}${target.search}${target.hash}`,
              ),
              baseUrl,
            ).href
          : baseUrl;
      } catch {
        return baseUrl;
      }
    },
  },
  logger: {
    error(code) {
      console.error(JSON.stringify({ event: "auth_library_error", code }));
    },
    warn(code) {
      console.warn(JSON.stringify({ event: "auth_library_warning", code }));
    },
    debug() {},
  },
};
