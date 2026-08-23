import { redirect } from 'next/navigation';

/**
 * Retired route. Blocked tasks now live in the unified task list; the route is kept
 * so existing links and bookmarks do not 404.
 */
export default function AdminBlockersPage() {
  redirect('/tasks?status=blocked');
}
