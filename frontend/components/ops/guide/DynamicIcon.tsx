import * as LucideIcons from 'lucide-react';

interface DynamicIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Only the props this component forwards; enough to render, no `any` needed. */
type IconLike = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;

export function DynamicIcon({ name, className, style }: DynamicIconProps) {
  const Icon = (LucideIcons as unknown as Record<string, IconLike | undefined>)[
    name
  ];
  if (!Icon) return <LucideIcons.BookOpen className={className} style={style} />;
  return <Icon className={className} style={style} />;
}
