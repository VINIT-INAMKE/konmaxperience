import { Node, mergeAttributes } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const CALLOUT_STYLES = {
  tip: {
    bg: 'bg-success/10',
    border: 'border-success',
    iconColor: 'text-success',
    Icon: CheckCircle2,
    role: 'note' as const,
  },
  warning: {
    bg: 'bg-[var(--status-warning)]/10',
    border: 'border-[var(--status-warning)]',
    iconColor: 'text-warning',
    Icon: AlertTriangle,
    role: 'alert' as const,
  },
  info: {
    bg: 'bg-info/10',
    border: 'border-info',
    iconColor: 'text-info',
    Icon: Info,
    role: 'note' as const,
  },
} as const;

type CalloutType = keyof typeof CALLOUT_STYLES;

function CalloutNodeView({ node }: ReactNodeViewProps) {
  const calloutType = ((node.attrs as Record<string, unknown>).type as string || 'info') as CalloutType;
  const style = CALLOUT_STYLES[calloutType] ?? CALLOUT_STYLES.info;
  const IconComponent = style.Icon;

  return (
    <NodeViewWrapper>
      <div
        role={style.role}
        className={`flex gap-3 rounded-lg px-4 py-3 my-4 ${style.bg} border-l-4 ${style.border}`}
      >
        <IconComponent className={`size-5 shrink-0 mt-0.5 ${style.iconColor}`} />
        <div className="text-[14px] leading-[1.5]">
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-type') || 'info',
        renderHTML: (attributes: { type: string }) => ({
          'data-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
      {
        tag: 'blockquote[data-type]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});
