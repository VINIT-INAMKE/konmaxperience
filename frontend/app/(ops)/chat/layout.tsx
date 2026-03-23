export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 top-0 lg:left-[240px] flex overflow-hidden bg-background">
      {children}
    </div>
  );
}
