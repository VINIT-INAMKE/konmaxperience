'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import { MissionForm } from '@/components/ops/missions/MissionForm';
import type { CreateMissionDto, Mission } from '@/lib/types/missions';

export default function NewMissionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: CreateMissionDto) {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post<Mission>('/missions', data);
      await queryClient.invalidateQueries({ queryKey: ['missions'] });
      router.push('/missions');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Your changes were not saved. Try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/missions"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Missions
          </Link>
        </div>
        <h1 className="text-2xl font-bold">New mission</h1>

        {/* Form */}
        <div className="max-w-2xl mx-auto">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <MissionForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
  );
}
