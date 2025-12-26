import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-foreground/10 bg-nav">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold text-foreground/80">
          <span className="font-extrabold text-foreground">CampusGuide</span>
          <span className="ml-2 text-foreground/60">© {year}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          <Link className="text-foreground/70 hover:text-foreground" href="/">
            Home
          </Link>
          <Link className="text-foreground/70 hover:text-foreground" href="/login">
            Login
          </Link>
          <Link className="text-foreground/70 hover:text-foreground" href="/register">
            Register
          </Link>
          <Link className="text-foreground/70 hover:text-foreground" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
