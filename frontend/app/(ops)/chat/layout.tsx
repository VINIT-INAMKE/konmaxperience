export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-4 sm:-m-6 flex flex-1 overflow-hidden h-full">
      {children}
    </div>
  );
}
