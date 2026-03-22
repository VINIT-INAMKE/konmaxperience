import * as LucideIcons from 'lucide-react';

interface DynamicIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export function DynamicIcon({ name, className, style }: DynamicIconProps) {
  const Icon = (LucideIcons as Record<string, any>)[name];
  if (!Icon) return <LucideIcons.BookOpen className={className} style={style} />;
  return <Icon className={className} style={style} />;
}
