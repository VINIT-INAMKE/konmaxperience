'use client';

import { useParams } from 'next/navigation';
import { RecipeBuilderPage } from '@/components/ops/operations/recipes/RecipeBuilderPage';

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  return <RecipeBuilderPage recipeId={id} />;
}
