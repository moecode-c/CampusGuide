"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import * as React from "react";

export function AppSessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
