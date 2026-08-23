'use client';

import React from 'react';
import type { Editor } from '@tiptap/react';
import {
  Pilcrow,
  List,
  ListOrdered,
  ImagePlus,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface GuideEditorToolbarProps {
  editor: Editor | null;
  onImageUpload: () => void;
  isUploading?: boolean;
}

function ToolbarButton({
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
        'size-8 rounded-md flex items-center justify-center',
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

export const GuideEditorToolbar = React.memo(function GuideEditorToolbar({
  editor,
  onImageUpload,
  isUploading,
}: GuideEditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/50 sticky top-[49px] z-10">
      {/* Group 1 - Block type */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        disabled={!editor}
        label="Heading 2"
      >
        <span className="text-xs font-bold">H2</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        disabled={!editor}
        label="Heading 3"
      >
        <span className="text-xs font-bold">H3</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        isActive={editor.isActive('heading', { level: 4 })}
        disabled={!editor}
        label="Heading 4"
      >
        <span className="text-xs font-bold">H4</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={
          !editor.isActive('heading', { level: 2 }) &&
          !editor.isActive('heading', { level: 3 }) &&
          !editor.isActive('heading', { level: 4 })
        }
        disabled={!editor}
        label="Paragraph"
      >
        <Pilcrow className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Group 2 - Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        disabled={!editor}
        label="Bullet list"
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        disabled={!editor}
        label="Ordered list"
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Group 3 - Media/blocks */}
      <ToolbarButton
        onClick={onImageUpload}
        disabled={!editor || isUploading}
        label="Insert image"
      >
        <ImagePlus className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'callout',
              attrs: { type: 'tip' },
              content: [{ type: 'text', text: '' }],
            })
            .run()
        }
        disabled={!editor}
        label="Insert tip callout"
      >
        <CheckCircle2 className="size-4 text-success" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'callout',
              attrs: { type: 'warning' },
              content: [{ type: 'text', text: '' }],
            })
            .run()
        }
        disabled={!editor}
        label="Insert warning callout"
      >
        <AlertTriangle className="size-4 text-warning" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'callout',
              attrs: { type: 'info' },
              content: [{ type: 'text', text: '' }],
            })
            .run()
        }
        disabled={!editor}
        label="Insert info callout"
      >
        <Info className="size-4 text-info" />
      </ToolbarButton>
    </div>
  );
});
