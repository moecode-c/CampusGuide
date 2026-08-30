export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-md items-center px-3 py-8 sm:px-4 sm:py-10">{children}</div>
  );
}
