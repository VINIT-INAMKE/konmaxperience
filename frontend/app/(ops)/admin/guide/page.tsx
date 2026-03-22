'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { GuideSectionList } from '@/components/ops/guide/admin/GuideSectionList';
import { GuideSectionForm } from '@/components/ops/guide/admin/GuideSectionForm';
import { GuideAdminSkeleton } from '@/components/ops/guide/admin/GuideAdminSkeleton';
import type { GuideSection, GuideSectionPage } from '@/lib/types/guides';

export default function AdminGuidePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Section form state
  const [createOpen, setCreateOpen] = useState(false);
  const [editSection, setEditSection] = useState<GuideSection | null>(null);

  // Delete section dialog state
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<GuideSection | null>(null);
  const [isDeletingSection, setIsDeletingSection] = useState(false);

  // Delete page dialog state
  const [deletePageTarget, setDeletePageTarget] = useState<GuideSectionPage | null>(null);
  const [isDeletingPage, setIsDeletingPage] = useState(false);

  const { data: sections, isLoading, isError } = useQuery({
    queryKey: ['guide-sections-admin'],
    queryFn: () => apiClient.get<GuideSection[]>('/guide/sections'),
  });

  const isEmpty = !isLoading && (!sections || sections.length === 0);

  // ── Handlers ──

  async function handleDeleteSection() {
    if (!deleteSectionTarget) return;
    setIsDeletingSection(true);
    try {
      await apiClient.delete(`/guide/sections/${deleteSectionTarget.id}`);
      await queryClient.invalidateQueries({ queryKey: ['guide-sections-admin'] });
      toast.success(`Section "${deleteSectionTarget.title}" deleted`);
      setDeleteSectionTarget(null);
    } catch {
      toast.error('Failed to delete section');
    } finally {
      setIsDeletingSection(false);
    }
  }

  async function handleDeletePage() {
    if (!deletePageTarget) return;
    setIsDeletingPage(true);
    try {
      await apiClient.delete(`/guide/pages/${deletePageTarget.id}`);
      await queryClient.invalidateQueries({ queryKey: ['guide-sections-admin'] });
      toast.success(`Page "${deletePageTarget.title}" deleted`);
      setDeletePageTarget(null);
    } catch {
      toast.error('Failed to delete page');
    } finally {
      setIsDeletingPage(false);
    }
  }

  async function handleCreatePage(sectionId: string) {
    try {
      const newPage = await apiClient.post<{ id: string }>('/guide/pages', {
        section_id: sectionId,
        title: 'Untitled page',
        content: '',
      });
      router.push(`/admin/guide/pages/${newPage.id}`);
    } catch {
      toast.error('Failed to create page');
    }
  }

  function handleEditPage(pageId: string) {
    router.push(`/admin/guide/pages/${pageId}`);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-semibold">Guide Management</h1>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1" />
            Add Section
          </Button>
        </div>
        <p className="text-[14px] text-muted-foreground mt-1">
          Create and manage guide sections and pages for your team.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && <GuideAdminSkeleton />}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Could not load guide sections. Try refreshing the page.
          </p>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !isError && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <BookOpen className="size-12 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">No guide sections yet</h2>
            <p className="text-sm text-muted-foreground">
              Create your first section to start building the team guide.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1" />
            Add Section
          </Button>
        </div>
      )}

      {/* Section list */}
      {sections && sections.length > 0 && (
        <GuideSectionList
          sections={sections}
          onEditSection={(section) => setEditSection(section)}
          onDeleteSection={(section) => setDeleteSectionTarget(section)}
          onCreatePage={handleCreatePage}
          onEditPage={handleEditPage}
          onDeletePage={(page) => setDeletePageTarget(page)}
        />
      )}

      {/* Section form Sheet (create) */}
      <GuideSectionForm
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* Section form Sheet (edit) */}
      <GuideSectionForm
        open={!!editSection}
        onOpenChange={(open) => {
          if (!open) setEditSection(null);
        }}
        section={editSection}
      />

      {/* Delete section confirmation dialog */}
      <Dialog
        open={!!deleteSectionTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteSectionTarget(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Delete &ldquo;{deleteSectionTarget?.title}&rdquo;?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the section and all{' '}
              {deleteSectionTarget?.pages.length ?? 0} pages inside it. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteSectionTarget(null)}
              disabled={isDeletingSection}
            >
              Keep Section
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSection}
              disabled={isDeletingSection}
            >
              {isDeletingSection ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none mr-1" />
                  Deleting...
                </>
              ) : (
                'Delete Section'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete page confirmation dialog */}
      <Dialog
        open={!!deletePageTarget}
        onOpenChange={(open) => {
          if (!open) setDeletePageTarget(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Delete &ldquo;{deletePageTarget?.title}&rdquo;?
            </DialogTitle>
            <DialogDescription>
              This page and its content will be permanently deleted. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeletePageTarget(null)}
              disabled={isDeletingPage}
            >
              Keep Page
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePage}
              disabled={isDeletingPage}
            >
              {isDeletingPage ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none mr-1" />
                  Deleting...
                </>
              ) : (
                'Delete Page'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
