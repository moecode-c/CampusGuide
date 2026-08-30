"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { UserManager } from "@/components/admin/UserManager";

function UsersInner() {
  // Security alerts link here as /admin/users?user=<id> so "Inspect" lands on
  // the account rather than a search box.
  const openUserId = useSearchParams().get("user");

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Users</h1>
      <p className="text-sm text-foreground/70">
        Every account on CampusGuide. Search by name, student ID, email or phone; open one to see its data and full
        history.
      </p>

      <div className="pt-4">
        <UserManager openUserId={openUserId} />
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  // useSearchParams needs a Suspense boundary or the whole route opts out of
  // static rendering with a build-time warning.
  return (
    <React.Suspense fallback={null}>
      <UsersInner />
    </React.Suspense>
  );
}
