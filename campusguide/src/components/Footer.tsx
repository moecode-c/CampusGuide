import Link from "next/link";
import { CalendarDays, ClipboardCheck, Github, Home, Library, Linkedin, Mail, MapPin, LayoutDashboard } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();

  const pageLinks = [
    { label: "Home", href: "/", icon: <Home className="h-4 w-4" /> },
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Attendance", href: "/attendance", icon: <ClipboardCheck className="h-4 w-4" /> },
    { label: "Calendar", href: "/calendar", icon: <CalendarDays className="h-4 w-4" /> },
    { label: "Resources", href: "/resources", icon: <Library className="h-4 w-4" /> },
    { label: "Map", href: "/map", icon: <MapPin className="h-4 w-4" /> },
  ];

  const contactLinks = [
    { label: "Email", href: "#", icon: <Mail className="h-4 w-4" /> },
    { label: "LinkedIn", href: "#", icon: <Linkedin className="h-4 w-4" /> },
    { label: "GitHub", href: "#", icon: <Github className="h-4 w-4" /> },
  ];

  return (
    <footer className="mt-10 border-t border-foreground/10 bg-nav">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-2 md:items-start">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground/80">
            <span className="font-extrabold text-foreground">CampusGuide</span>
            <span className="ml-2 text-foreground/60">© {year}</span>
          </div>
          <div className="text-xs font-semibold text-foreground/60">
            Built by <span className="text-foreground/80">Mohammed Essam El Din</span> • Software Developer
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
                  <a className="inline-flex items-center gap-2 hover:text-foreground" href={l.href}>
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
