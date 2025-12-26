import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";

export async function requireRole(role: "student" | "admin") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (session.user.role !== role) return null;
  return session;
}
