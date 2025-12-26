export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md items-center px-4 py-10">{children}</div>
  );
}
