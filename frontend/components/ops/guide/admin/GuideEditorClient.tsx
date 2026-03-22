'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { Placeholder } from '@tiptap/extensions';
import Typography from '@tiptap/extension-typography';
import { CalloutExtension } from '@/components/ops/guide/GuideCalloutBlock';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Check,
  Circle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GuideEditorToolbar } from './GuideEditorToolbar';
import { GuideEditorBubbleMenu } from './GuideEditorBubbleMenu';
import {
  validateImageFile,
  uploadImageToR2,
  ImageUploadError,
} from './GuideImageUploadHandler';
import type { GuidePage } from '@/lib/types/guides';

const PLACEHOLDER_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2UyZThlYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTRhM2IzIiBmb250LXNpemU9IjE0Ij5VcGxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';

async function hashContent(content: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface GuideEditorClientProps {
  pageId: string;
}

export function GuideEditorClient({ pageId }: GuideEditorClientProps) {
  const { data: page, isLoading } = useQuery({
    queryKey: ['guide-page', pageId],
    queryFn: () => apiClient.get<GuidePage>(`/guide/pages/${pageId}`),
  });

  if (isLoading || !page) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <GuideEditorInner pageId={pageId} initialPage={page} />;
}

function GuideEditorInner({
  pageId,
  initialPage,
}: {
  pageId: string;
  initialPage: GuidePage;
}) {
  const [title, setTitle] = useState(initialPage.title);
  const [status, setStatus] = useState<'draft' | 'published'>(
    initialPage.status as 'draft' | 'published',
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'unsaved'
  >('idle');
  const [isUploading, setIsUploading] = useState(false);

  const lastSavedHashRef = useRef<string>('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleMenuRef = useRef<HTMLDivElement>(null);
  const [bubbleMenuMounted, setBubbleMenuMounted] = useState(false);

  // Parse initial content from JSON string
  let parsedContent: Record<string, unknown> | null = null;
  try {
    parsedContent = JSON.parse(initialPage.content);
  } catch {
    parsedContent = null;
  }

  const triggerAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      if (!editorRef.current) return;
      const html = editorRef.current.getHTML();
      const hash = await hashContent(html);
      if (hash === lastSavedHashRef.current) return;
      setSaveState('saving');
      try {
        await apiClient.patch(`/guide/pages/${pageId}`, {
          content: html,
          title: titleRef.current,
        });
        lastSavedHashRef.current = hash;
        setIsDirty(false);
        setSaveState('saved');
        setTimeout(
          () => setSaveState((prev) => (prev === 'saved' ? 'idle' : prev)),
          3000,
        );
      } catch {
        toast.error('Failed to save. Check your connection and try again.');
        setSaveState('unsaved');
      }
    }, 5000);
  }, [pageId]);

  // Refs to avoid stale closures in autosave
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const titleRef = useRef(title);
  titleRef.current = title;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      CalloutExtension,
      Placeholder.configure({
        placeholder: 'Start writing your guide page...',
      }),
      Typography,
    ],
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: true,
    content: parsedContent,
    onUpdate: () => {
      setIsDirty(true);
      setSaveState('unsaved');
      triggerAutosave();
    },
  });

  editorRef.current = editor;

  // Ensure bubble menu container is mounted before registering plugin
  useEffect(() => {
    if (bubbleMenuRef.current) {
      setBubbleMenuMounted(true);
    }
  }, []);

  // Register BubbleMenu plugin after editor and DOM element are ready
  useEffect(() => {
    if (!editor || !bubbleMenuRef.current || !bubbleMenuMounted) return;

    const plugin = BubbleMenuPlugin({
      pluginKey: 'guideBubbleMenu',
      editor,
      element: bubbleMenuRef.current,
    });

    editor.registerPlugin(plugin);

    return () => {
      editor.unregisterPlugin('guideBubbleMenu');
    };
  }, [editor, bubbleMenuMounted]);

  // Initialize content hash
  useEffect(() => {
    if (editor && initialPage.content) {
      try {
        const parsed = JSON.parse(initialPage.content);
        if (parsed) {
          const html = editor.getHTML();
          hashContent(html).then((hash) => {
            lastSavedHashRef.current = hash;
          });
        }
      } catch {
        // Content not valid JSON, ignore
      }
    }
  }, [editor, initialPage.content]);

  // Autosave on title change (debounced)
  useEffect(() => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    // Skip the initial render
    if (title === initialPage.title && !isDirty) return;
    titleTimerRef.current = setTimeout(() => {
      triggerAutosave();
    }, 5000);
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, [title, initialPage.title, isDirty, triggerAutosave]);

  // Unsaved changes warning -- browser tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, []);

  // Image upload handler (shared by toolbar, drag-drop, paste)
  async function handleImageUpload(file: File) {
    try {
      validateImageFile(file);
    } catch (err) {
      if (err instanceof ImageUploadError) {
        toast.error(err.message);
      }
      return;
    }

    if (!editor) return;
    setIsUploading(true);

    // Insert placeholder image immediately
    editor.chain().focus().setImage({ src: PLACEHOLDER_SRC }).run();

    try {
      const finalUrl = await uploadImageToR2(file);
      // Replace placeholder with final URL
      const { tr } = editor.state;
      editor.state.doc.nodesBetween(
        0,
        editor.state.doc.content.size,
        (node, pos) => {
          if (
            node.type.name === 'image' &&
            node.attrs.src === PLACEHOLDER_SRC
          ) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              src: finalUrl,
            });
          }
        },
      );
      editor.view.dispatch(tr);
      setIsDirty(true);
      setSaveState('unsaved');
      triggerAutosave();
    } catch {
      // Remove placeholder on failure
      const { tr } = editor.state;
      editor.state.doc.nodesBetween(
        0,
        editor.state.doc.content.size,
        (node, pos) => {
          if (
            node.type.name === 'image' &&
            node.attrs.src === PLACEHOLDER_SRC
          ) {
            tr.delete(pos, pos + node.nodeSize);
          }
        },
      );
      editor.view.dispatch(tr);
      toast.error('Image upload failed. Try again or use a different file.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleImageUpload(file);
          break;
        }
      }
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleImageUpload(f);
    e.target.value = '';
  }

  async function handlePublish() {
    if (!editor) return;
    const html = editor.getHTML();
    try {
      await apiClient.patch(`/guide/pages/${pageId}`, {
        content: html,
        title,
        status: 'published',
      });
      const hash = await hashContent(html);
      lastSavedHashRef.current = hash;
      setStatus('published');
      setIsDirty(false);
      setSaveState('saved');
      toast.success('Page published');
    } catch {
      toast.error('Failed to publish. Try again.');
    }
  }

  async function handleUnpublish() {
    try {
      await apiClient.patch(`/guide/pages/${pageId}`, { status: 'draft' });
      setStatus('draft');
      toast.success('Page unpublished');
    } catch {
      toast.error('Failed to unpublish. Try again.');
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header bar - sticky */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card sticky top-0 z-10">
        {/* Left: Back link */}
        <Link
          href="/admin/guide"
          onNavigate={(e) => {
            if (
              isDirty &&
              !window.confirm('You have unsaved changes. Leave anyway?')
            ) {
              e.preventDefault();
            }
          }}
          className="flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="size-4" /> Guide Management
        </Link>

        {/* Center: Page title input */}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
            setSaveState('unsaved');
          }}
          placeholder="Untitled page"
          className="text-[20px] font-semibold bg-transparent border-none outline-none w-full max-w-[600px] placeholder:text-muted-foreground text-center mx-4"
          aria-label="Page title"
        />

        {/* Right: Autosave indicator + Publish controls */}
        <div className="flex items-center gap-3 shrink-0" aria-live="polite">
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-[14px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Saving...
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-[14px] text-success">
              <Check className="size-3" /> Saved
            </span>
          )}
          {saveState === 'unsaved' && (
            <span className="flex items-center gap-1 text-[14px] text-amber-500">
              <Circle className="size-3 fill-current" /> Unsaved changes
            </span>
          )}

          {status === 'draft' ? (
            <Button onClick={handlePublish} variant="default">
              Publish
            </Button>
          ) : (
            <>
              <Badge className="bg-success/10 text-success border-success/20">
                Published
              </Badge>
              <Button
                onClick={handleUnpublish}
                variant="outline"
                className="text-muted-foreground"
              >
                Unpublish
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Fixed toolbar */}
      <GuideEditorToolbar
        editor={editor}
        onImageUpload={() => fileInputRef.current?.click()}
        isUploading={isUploading}
      />

      {/* Draft banner */}
      {status === 'draft' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 mx-6 mt-4 flex items-center gap-2 text-[14px] text-amber-600">
          <AlertTriangle className="size-4" /> This page is a draft. Only admins
          can see it.
        </div>
      )}

      {/* Bubble menu container - positioned by Tippy.js via BubbleMenuPlugin */}
      <div ref={bubbleMenuRef} className="z-50">
        {editor &&
          createPortal(
            <div className="animate-in fade-in-0 zoom-in-95 duration-150">
              <GuideEditorBubbleMenu editor={editor} />
            </div>,
            bubbleMenuRef.current!,
          )}
      </div>

      {/* Editor content area with drag-drop and paste zones */}
      <div
        className="px-6 py-8 min-h-[calc(100vh-120px)]"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <EditorContent
          editor={editor}
          className="prose prose-neutral dark:prose-invert max-w-none"
        />
      </div>

      {/* Hidden file input for toolbar image upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
}
