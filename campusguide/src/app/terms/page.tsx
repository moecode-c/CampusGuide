import Link from "next/link";
import { AlertTriangle, Lock, ScrollText, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TERMS_SECTIONS, TERMS_UPDATED, TERMS_VERSION } from "@/lib/terms";

export const metadata = {
  title: "Rules & Conditions | CampusGuide",
  description: "The rules every CampusGuide account agrees to.",
};

/**
 * Deliberately outside the (app) route group, so it is readable without an
 * account. Someone has to be able to read what they are agreeing to *before*
 * they agree to it, and a banned user has to be able to see the rules they were
 * removed under.
 */
const ICONS = [AlertTriangle, Lock, ShieldAlert, ScrollText, ScrollText];

export default function TermsPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-3 py-8 sm:px-4 sm:py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">Rules &amp; Conditions</h1>
        <p className="text-sm text-foreground/60">
          Version {TERMS_VERSION} · Last updated {TERMS_UPDATED}
        </p>
        <p className="text-base text-foreground/80">
          Everyone who creates a CampusGuide account agrees to these rules. Please read them.
        </p>
      </header>

      {/* The two points that carry real consequences, stated up front rather
          than buried in the middle of the list. */}
      <Card className="mt-7 border-risk/40 bg-risk/5">
        <CardContent className="space-y-3 py-5">
          <p className="flex items-start gap-2.5 text-base font-extrabold">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
            Using this website, and especially the attendance calculator, is your own
            responsibility.
          </p>
          <p className="flex items-start gap-2.5 text-base font-extrabold">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
            This site is for MIU students only. Sharing it with anyone else is strictly
            prohibited.
          </p>
          <p className="flex items-start gap-2.5 text-base font-extrabold">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
            Suspicious activity or breaking these rules may result in legal action and action
            from the university.
          </p>
        </CardContent>
      </Card>

      <div className="mt-9 space-y-9">
        {TERMS_SECTIONS.map((section, i) => {
          const Icon = ICONS[i] ?? ScrollText;
          return (
            <section key={section.id} id={section.id} className="scroll-mt-6">
              <h2 className="flex items-start gap-2.5 text-xl font-extrabold tracking-tight">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <span>
                  {i + 1}. {section.title}
                </span>
              </h2>
              <div className="mt-3 space-y-3 pl-8">
                {section.body.map((para, j) => (
                  <p
                    key={j}
                    // The opening line of each section is the binding one.
                    className={j === 0 ? "font-semibold text-foreground" : "text-foreground/75"}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-10 border-t border-foreground/10 pt-6 text-sm text-foreground/60">
        Questions about these rules? Contact the administrator. If you do not agree to them, do
        not create an account —{" "}
        <Link href="/" className="font-semibold text-primary underline-offset-4 hover:underline">
          return to the home page
        </Link>
        .
      </p>
    </div>
  );
}
