import { Analytics as VercelWebAnalytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics only — cookie-less page views in the deployment
 * dashboard. Enable once under Analytics → Enable; no env var needed.
 * The script is a no-op outside a Vercel deployment.
 */
export function Analytics() {
  return <VercelWebAnalytics />;
}
