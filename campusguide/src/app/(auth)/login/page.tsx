import { Suspense } from "react";
import { LoginClient } from "./LoginClient";

export default function LoginPage() {
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
