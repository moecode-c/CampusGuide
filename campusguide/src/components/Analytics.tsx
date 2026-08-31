import Script from "next/script";
import { Analytics as VercelWebAnalytics } from "@vercel/analytics/next";

/**
 * Two trackers, on purpose: Vercel Web Analytics for a quick cookie-less view
 * of traffic in the deployment dashboard, and GA4 for the deeper reports.
 *
 * The GA measurement ID is a public identifier, so it ships with the bundle;
 * the env var only exists so a fork or a staging deploy can point somewhere
 * else. GA is skipped under `next dev` — otherwise every local page refresh
 * would land in the real property and skew the numbers. Vercel's script sends
 * nothing outside a Vercel deployment, so it needs no such guard.
 *
 * GA4's enhanced measurement reports client-side route changes from History
 * API events, so the single `config` call below covers the whole app.
 */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-755QW70JZZ";

export function Analytics() {
  const googleEnabled = process.env.NODE_ENV === "production" && Boolean(MEASUREMENT_ID);

  return (
    <>
      <VercelWebAnalytics />
      {googleEnabled ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${MEASUREMENT_ID}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}
