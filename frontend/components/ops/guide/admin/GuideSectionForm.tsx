'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/lib/api-client';
import { RoleCode, ROLE_DISPLAY_NAMES } from '@/lib/types/roles';
import { GuideIconPicker } from '@/components/ops/guide/admin/GuideIconPicker';
import { GuideColorPicker } from '@/components/ops/guide/admin/GuideColorPicker';
import type { GuideSection } from '@/lib/types/guides';

interface GuideSectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section?: GuideSection | null;
}

export function GuideSectionForm({
  open,
  onOpenChange,
  section,
}: GuideSectionFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!section;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (section) {
      setTitle(section.title);
      setDescription(section.description || '');
      setIcon(section.icon);
      setAccentColor(section.accent_color);
      setSelectedRoles(section.role_codes);
    } else {
      setTitle('');
      setDescription('');
      setIcon(null);
      setAccentColor(null);
      setSelectedRoles([]);
    }
  }, [section, open]);

  function toggleRole(roleCode: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleCode)
        ? prev.filter((r) => r !== roleCode)
        : [...prev, roleCode],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      icon: icon || undefined,
      accent_color: accentColor || undefined,
      role_codes: selectedRoles.length > 0 ? selectedRoles : undefined,
    };

    try {
      if (isEditing && section) {
        await apiClient.patch(`/guide/sections/${section.id}`, payload);
        toast.success('Section updated');
      } else {
        await apiClient.post('/guide/sections', payload);
        toast.success('Section created');
      }
      await queryClient.invalidateQueries({ queryKey: ['guide-sections-admin'] });
      onOpenChange(false);
    } catch {
      toast.error('Failed to save section');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[500px] w-full overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>{isEditing ? 'Edit Section' : 'Add Section'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 py-6 px-1">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="section-title">Section title</Label>
              <Input
                id="section-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kitchen Operations"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="section-description">Description</Label>
              <Textarea
                id="section-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this section covers"
                rows={3}
              />
            </div>

            {/* Icon picker */}
            <GuideIconPicker value={icon} onChange={setIcon} />

            {/* Color picker */}
            <GuideColorPicker value={accentColor} onChange={setAccentColor} />

            {/* Role multi-select */}
            <div className="space-y-3">
              <Label>Visible to roles</Label>
              <div className="space-y-2">
                {Object.entries(ROLE_DISPLAY_NAMES).map(([code, displayName]) => (
                  <div key={code} className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${code}`}
                      checked={selectedRoles.includes(code)}
                      onCheckedChange={() => toggleRole(code)}
                    />
                    <label
                      htmlFor={`role-${code}`}
                      className="text-[14px] cursor-pointer"
                    >
                      {displayName}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none mr-1" />
                  Saving...
                </>
              ) : (
                'Save Section'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
