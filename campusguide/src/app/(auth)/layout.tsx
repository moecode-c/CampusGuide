export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // flex-col, not a bare flex: the sign-in page renders a card *and* a
    // forgot-password line as siblings. In a row they became two columns and
    // squeezed the card to half width. Cross-axis stretch (the default) is
    // what makes the card fill max-w-md, so no items-center here.
    <div className="mx-auto flex w-full min-w-0 max-w-md flex-col px-3 py-8 sm:px-4 sm:py-10">
      {children}
    </div>
  );
}
