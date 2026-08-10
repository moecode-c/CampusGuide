import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { connectToDatabase } from "@/server/db";
import { AccountStatuses, User } from "@/server/models/User";
import { env } from "@/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ShieldAlert, ShieldCheck } from "lucide-react";

/** Digits only — what wa.me expects in a deep link. */
function waLink(number: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

export default async function PendingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?next=/pending");

  await connectToDatabase();
  const user = await User.findById(session.user.id).select("name miuId status rejectionReason banReason").lean();
  if (!user) redirect("/login");

  const status = user.status ?? AccountStatuses.Active;
  if (status === AccountStatuses.Active) redirect("/dashboard");

  const whatsapp = env.VERIFY_WHATSAPP_NUMBER;

  if (status === AccountStatuses.Banned) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-risk">
            <ShieldAlert className="h-5 w-5" />
            Account suspended
          </CardTitle>
          <CardDescription>This account no longer has access to CampusGuide.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {user.banReason ? (
            <p className="rounded-2xl bg-background p-4">
              <span className="font-semibold">Reason: </span>
              {user.banReason}
            </p>
          ) : null}
          {whatsapp ? (
            <p className="text-foreground/70">
              If you believe this is a mistake, contact the administrator on{" "}
              <span className="font-semibold">{whatsapp}</span>.
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          One last step
        </CardTitle>
        <CardDescription>
          Your account is registered but not verified yet. Verification is manual, so that only MIU students get in.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning">Awaiting verification</Badge>
          {user.miuId ? <Badge tone="neutral">{user.miuId}</Badge> : null}
        </div>

        {user.rejectionReason ? (
          <div className="rounded-2xl border border-risk/25 bg-risk/10 p-4 text-sm">
            <p className="font-bold text-risk">Your last submission was not accepted</p>
            <p className="mt-1 text-foreground/80">{user.rejectionReason}</p>
            <p className="mt-1 text-foreground/70">Send a clearer photo and it will be reviewed again.</p>
          </div>
        ) : null}

        <div className="rounded-2xl bg-background p-5">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <MessageCircle className="h-5 w-5 text-success" />
            Send a photo of your university ID on WhatsApp
          </p>

          {whatsapp ? (
            <>
              <p className="mt-3 text-3xl font-extrabold tracking-tight">{whatsapp}</p>
              <a
                href={waLink(whatsapp)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" />
                Open WhatsApp
              </a>
            </>
          ) : (
            <p className="mt-3 text-sm text-foreground/70">
              The verification number has not been configured yet. Set VERIFY_WHATSAPP_NUMBER in the environment.
            </p>
          )}

          <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-foreground/80">
            <li>Take a clear photo of your MIU student ID card.</li>
            <li>
              Send it to the number above, along with your student ID{" "}
              {user.miuId ? <span className="font-semibold">({user.miuId})</span> : null}.
            </li>
            <li>Once it is approved, sign in again and you will have full access.</li>
          </ol>
        </div>

        <p className="text-xs text-foreground/60">
          Signed in as {user.name}. This page refreshes your status every time you open it.
        </p>
      </CardContent>
    </Card>
  );
}
