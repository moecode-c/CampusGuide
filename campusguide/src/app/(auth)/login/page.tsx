import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/security/requireSession";
import { LoginClient } from "./LoginClient";

export default async function LoginPage() {
  const session = await requireSession();
  if (session) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={<p className="text-sm text-foreground/70">Loading…</p>}>
          <LoginClient />
        </Suspense>
      </div>
    </main>
  );
}
