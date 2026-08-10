import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { env } from "@/env";
import { connectToDatabase } from "@/server/db";
import { AccountStatuses, User } from "@/server/models/User";
import { Roles } from "@/server/roles";
import { ActivityActions } from "@/server/models/ActivityLog";
import { logActivity } from "@/server/activity";
import { isValidMiuId, normalizeMiuId } from "@/lib/miu";
import { z } from "zod";

// Students know their student ID better than their university email, so either
// works. The field is still called `email` because that is what the sign-in form
// and NextAuth have always posted.
const credentialsSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(8).max(200),
});

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const identifier = parsed.data.email.trim();

        await connectToDatabase();

        // A student ID contains a slash and an email does not, so the shape of
        // the input decides which field to look in.
        const asMiuId = normalizeMiuId(identifier);
        const user = isValidMiuId(asMiuId)
          ? await User.findOne({ miuId: asMiuId }).lean()
          : await User.findOne({ email: identifier.toLowerCase() }).lean();

        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // Banned accounts are turned away at the door. Pending ones are let in
        // deliberately — they need to reach the "send your ID" screen.
        if (user.status === AccountStatuses.Banned) return null;

        await logActivity({
          action: ActivityActions.SignIn,
          actor: { id: String(user._id), name: user.name, miuId: user.miuId },
          targetId: String(user._id),
          targetType: "user",
        });

        return {
          id: String(user._id),
          email: user.email,
          name: user.name,
          role: user.role ?? Roles.Student,
          academicYear: user.academicYear,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.academicYear = (user as any).academicYear;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = (token as any).role;
        (session.user as any).academicYear = (token as any).academicYear;
      }
      return session;
    },
  },
};
