'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DecisionList } from '@/components/ops/decisions/DecisionList';
import { DecisionForm } from '@/components/ops/decisions/DecisionForm';
import { apiClient } from '@/lib/api-client';
import type { Decision, DecisionStatus } from '@/lib/types/decisions';
import { ExportButton } from '@/components/ops/exports/ExportButton';

type StatusFilter = 'all' | DecisionStatus;

export default function DecisionsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [newDecisionId, setNewDecisionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: decisions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['decisions', statusFilter],
    queryFn: () =>
      apiClient.get<Decision[]>(
        `/decisions${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`,
      ),
  });

  const filteredDecisions = useMemo(() => {
    if (!decisions) return [];
    if (!searchQuery.trim()) return decisions;
    const query = searchQuery.toLowerCase();
    return decisions.filter((d) => d.title.toLowerCase().includes(query));
  }, [decisions, searchQuery]);

  // Clear newDecisionId after 3.5 seconds
  useEffect(() => {
    if (newDecisionId) {
      const timer = setTimeout(() => setNewDecisionId(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [newDecisionId]);

  const handleDecisionCreated = (id: string) => {
    setNewDecisionId(id);
    void queryClient.invalidateQueries({ queryKey: ['decisions'] });
  };

  return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Decisions</h1>
          <div className="flex items-center gap-2">
            <ExportButton reportType="decision_log" reportName="Decision Log" isTimeSeries={false} />
            <Button onClick={() => setFormOpen(true)}>Log Decision</Button>
          </div>
        </div>

        {/* Filter bar: tabs + search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="proposed">Proposed</TabsTrigger>
              <TabsTrigger value="aligned">Aligned</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="reopened">Reopened</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search decisions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Decision list */}
        <DecisionList
          decisions={filteredDecisions}
          isLoading={isLoading}
          isError={isError}
          newDecisionId={newDecisionId}
          onLogDecision={() => setFormOpen(true)}
        />

        {/* Log Decision Sheet */}
        <DecisionForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onCreated={handleDecisionCreated}
        />
      </div>
  );
}
