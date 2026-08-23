'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import DOMPurify from 'isomorphic-dompurify';
import { generateHTML } from '@tiptap/html';
import type { JSONContent } from '@tiptap/core';
import { CalloutExtension } from './GuideCalloutBlock';

interface GuideProseRendererProps {
  content: string; // JSON-stringified Tiptap doc from API
}

export function GuideProseRenderer({ content }: GuideProseRendererProps) {
  const extensions = [StarterKit, Image, CalloutExtension];

  // Parse stored JSON string into Tiptap doc. QA-04: typed as tiptap's own
  // `JSONContent` (`{ type?, content?, attrs?, … }`) instead of an `any` cast.
  let parsedContent: JSONContent | null = null;
  try {
    parsedContent = JSON.parse(content) as JSONContent;
  } catch {
    parsedContent = null;
  }

  // Defense-in-depth per D-07: sanitize generateHTML output before passing to editor
  const sanitizedHtml = parsedContent
    ? DOMPurify.sanitize(generateHTML(parsedContent, extensions))
    : '';

  const editor = useEditor({
    extensions,
    editable: false,
    immediatelyRender: false,
    content: sanitizedHtml,
  });

  if (!parsedContent) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No content yet.</p>
      </div>
    );
  }

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none text-[16px] leading-[1.75]">
      <EditorContent editor={editor} />
    </div>
  );
}
