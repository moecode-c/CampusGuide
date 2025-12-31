import { redirect } from "next/navigation";
import { requireSession } from "@/server/security/requireSession";
import { RegisterClient } from "./RegisterClient";

export default async function RegisterPage() {
  const session = await requireSession();
  if (session) redirect("/dashboard");

  return <RegisterClient />;
}
