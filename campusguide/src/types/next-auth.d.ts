import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "student" | "admin";
      academicYear: 1 | 2 | 3 | 4;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "student" | "admin";
    academicYear?: 1 | 2 | 3 | 4;
  }
}
