import { GuideEditorPageShell } from '@/components/ops/guide/admin/GuideEditorPageShell';

export default async function GuideEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <GuideEditorPageShell pageId={id} />;
}
