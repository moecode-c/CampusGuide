"use client";

import { UserManager } from "@/components/admin/UserManager";

export default function AdminVerificationPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Verification</h1>
      <p className="text-sm text-foreground/70">
        Students who registered but haven&apos;t been approved yet. Each one was told to send a photo of their MIU ID
        on WhatsApp — check it against the student ID and email shown here, then verify or reject.
      </p>

      <div className="pt-4">
        <UserManager
          defaultStatus="pending"
          lockStatusFilter
          emptyMessage="Nothing waiting. Every registration has been reviewed."
        />
      </div>
    </div>
  );
}
