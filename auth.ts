import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const demoLoginEnabled =
  process.env.NODE_ENV !== "production" && (process.env.DEMO_LOGIN === "true" || !googleEnabled);

const providers: Provider[] = [];
if (googleEnabled) providers.push(Google);
if (demoLoginEnabled) {
  // Solo para desarrollo local: permite probar la app sin configurar Google.
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {},
      authorize: async () => ({ id: "demo-user", name: "Usuario Demo", email: "demo@ejemplo.es" }),
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    jwt({ token, account, profile }) {
      // Identificador estable del usuario: el "sub" de Google.
      if (account?.provider === "google" && profile?.sub) token.uid = `google:${profile.sub}`;
      if (account?.provider === "demo") token.uid = "demo:demo-user";
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

/** Devuelve el id del usuario autenticado o null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
