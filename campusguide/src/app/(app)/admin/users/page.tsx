"use client";

import { UserManager } from "@/components/admin/UserManager";

export default function AdminUsersPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Users</h1>
      <p className="text-sm text-foreground/70">
        Every account on CampusGuide. Search by name, student ID, email or phone; open one to see its data and full
        history.
      </p>

      <div className="pt-4">
        <UserManager />
      </div>
    </div>
  );
}
