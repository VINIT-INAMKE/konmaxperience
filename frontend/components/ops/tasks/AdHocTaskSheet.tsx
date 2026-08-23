'use client';

/**
 * The ad-hoc entry point — kept as a named component because five call sites
 * (the spine's quick action, Mission Control's Action Required panel, the
 * kanban and list empty states) speak in terms of "inject ad-hoc work".
 *
 * Since Task 16 it is a two-line specialisation of `TaskSheet`: same mission →
 * quest pickers, same `TaskForm`, same unsaved-changes guard, with the type
 * locked to `adhoc`. Prefer `<TaskSheet mode="create" />` directly for anything
 * that is not specifically ad-hoc.
 */

import { TaskSheet } from './TaskSheet';

interface AdHocTaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdHocTaskSheet({ open, onOpenChange }: AdHocTaskSheetProps) {
  return (
    <TaskSheet
      open={open}
      onOpenChange={onOpenChange}
      mode="create"
      defaultTaskType="adhoc"
    />
  );
}
