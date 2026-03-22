'use client';

import type { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface GuideEditorBubbleMenuProps {
  editor: Editor | null;
}

function BubbleButton({
  onClick,
  isActive,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'size-7 rounded-md flex items-center justify-center',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-muted',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
      aria-label={label}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
}

export function GuideEditorBubbleMenu({ editor }: GuideEditorBubbleMenuProps) {
  if (!editor) return null;

  function handleLinkToggle() {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt('URL:');
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
    }
  }

  return (
    <div
      role="toolbar"
      className="bg-popover border rounded-lg shadow-md flex items-center gap-1 p-1"
    >
      <BubbleButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        disabled={!editor}
        label="Toggle bold"
      >
        <Bold className="size-4" />
      </BubbleButton>
      <BubbleButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        disabled={!editor}
        label="Toggle italic"
      >
        <Italic className="size-4" />
      </BubbleButton>
      <BubbleButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        disabled={!editor}
        label="Toggle underline"
      >
        <Underline className="size-4" />
      </BubbleButton>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      <BubbleButton
        onClick={handleLinkToggle}
        isActive={editor.isActive('link')}
        disabled={!editor}
        label="Toggle link"
      >
        <Link2 className="size-4" />
      </BubbleButton>
    </div>
  );
}
