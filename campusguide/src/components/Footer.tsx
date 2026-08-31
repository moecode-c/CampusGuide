import Link from "next/link";
import {
  CalendarDays,
  ClipboardCheck,
  ExternalLink,
  Github,
  Home,
  LayoutDashboard,
  Library,
  Linkedin,
  Mail,
  MapPin,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();

  const pageLinks = [
    { label: "Home", href: "/", icon: <Home className="h-4 w-4" /> },
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Attendance", href: "/attendance", icon: <ClipboardCheck className="h-4 w-4" /> },
    { label: "Calendar", href: "/calendar", icon: <CalendarDays className="h-4 w-4" /> },
    { label: "Resources", href: "/resources", icon: <Library className="h-4 w-4" /> },
    { label: "Map", href: "/map", icon: <MapPin className="h-4 w-4" /> },
    { label: "Rules & Conditions", href: "/terms", icon: <ScrollText className="h-4 w-4" /> },
    { label: "Privacy Policy", href: "/privacy", icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  const contactLinks = [
    { label: "Portfolio", href: "https://moeportfoliov2.vercel.app", icon: <ExternalLink className="h-4 w-4" /> },
    { label: "Email", href: "mailto:mohammedessameldincs@gmail.com", icon: <Mail className="h-4 w-4" /> },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/mohammed-essam-el-din-716b64364", icon: <Linkedin className="h-4 w-4" /> },
    { label: "GitHub", href: "https://github.com/moecode-c", icon: <Github className="h-4 w-4" /> },
  ];

  return (
    <footer className="mt-10 border-t border-foreground/10 bg-nav">
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 px-3 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-4 md:grid-cols-2 md:items-start">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground/80">
            <span className="font-extrabold text-foreground">CampusGuide</span>
            <span className="ml-2 text-foreground/60">© {year}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground/60">
            <span>
              Built by <span className="text-foreground/80">Mohammed Essam El Din</span> • Software Developer
            </span>
            <a
              href="https://moeportfoliov2.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-foreground/12 bg-panel/30 px-2 py-1 text-foreground/80 hover:text-foreground hover:border-foreground/20"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Portfolio
            </a>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 md:justify-end">
          <div>
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-foreground/60">Pages</div>
            <ul className="list-disc space-y-1 pl-4 text-sm font-semibold">
              {pageLinks.map((l) => (
                <li key={l.href} className="text-foreground/70">
                  <Link className="inline-flex items-center gap-2 hover:text-foreground" href={l.href}>
                    <span className="text-foreground/60">{l.icon}</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-foreground/60">Contact</div>
            <ul className="list-disc space-y-1 pl-4 text-sm font-semibold">
              {contactLinks.map((l) => (
                <li key={l.label} className="text-foreground/70">
                  <a
                    className="inline-flex items-center gap-2 hover:text-foreground"
                    href={l.href}
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    <span className="text-foreground/60">{l.icon}</span>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
