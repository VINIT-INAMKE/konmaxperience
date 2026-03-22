'use client';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="light min-h-screen bg-white text-foreground flex flex-col">
      <header className="h-14 border-b bg-white/95 backdrop-blur sticky top-0 z-10 flex items-center px-4">
        <span className="text-sm font-semibold tracking-tight text-gray-900">
          Konma Xperience
        </span>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="h-10 flex items-center justify-center">
        <span className="text-xs text-gray-500">
          Powered by Konma Xperience
        </span>
      </footer>
    </div>
  );
}
