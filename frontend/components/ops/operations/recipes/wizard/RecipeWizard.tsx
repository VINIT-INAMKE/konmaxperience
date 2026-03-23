'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { Recipe } from '@/lib/types/recipe';
import { RecipeWizardStep1 } from './RecipeWizardStep1';
import { RecipeWizardStep2 } from './RecipeWizardStep2';
import { RecipeWizardStep3 } from './RecipeWizardStep3';
import type { RecipeDetailsState } from './RecipeWizardStep1';
import type { BomLineState } from './BomLineRow';

const EMPTY_DETAILS: RecipeDetailsState = {
  name: '',
  description: '',
  prep_steps: '',
  cooking_method: '',
  yield_qty: '',
  yield_unit: 'g',
  portion_size: '',
  shelf_life_hours: '',
  brand_id: '',
  zone_id: '',
  image_url: '',
  status: '',
};

function mapRecipeToDetails(recipe: Recipe): RecipeDetailsState {
  return {
    name: recipe.name,
    description: recipe.description ?? '',
    prep_steps: recipe.prep_steps ?? '',
    cooking_method: recipe.cooking_method ?? '',
    yield_qty: String(recipe.yield_qty),
    yield_unit: recipe.yield_unit,
    portion_size: recipe.portion_size ?? '',
    shelf_life_hours: recipe.shelf_life_hours != null ? String(recipe.shelf_life_hours) : '',
    brand_id: recipe.brand_id ?? '',
    zone_id: recipe.zone_id ?? '',
    image_url: recipe.image_url ?? '',
    status: recipe.status,
  };
}

function mapRecipeToLines(recipe: Recipe): BomLineState[] {
  if (!recipe.RecipeLines) return [];
  return recipe.RecipeLines.map((line) => ({
    id: line.id,
    input_type: line.input_type,
    item_id: line.ingredient_id ?? line.source_recipe_id ?? '',
    item_name:
      line.ingredient?.name ?? line.source_recipe?.name ?? '',
    quantity: String(line.quantity),
    unit: line.unit,
    prep_notes: line.prep_notes ?? '',
  }));
}

const STEP_LABELS = ['Details', 'Ingredients', 'Review'];

interface RecipeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe?: Recipe;
  onSuccess: (id: string) => void;
}

export function RecipeWizard({ open, onOpenChange, recipe, onSuccess }: RecipeWizardProps) {
  const queryClient = useQueryClient();
  const isEditMode = !!recipe;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [details, setDetails] = useState<RecipeDetailsState>(
    recipe ? mapRecipeToDetails(recipe) : EMPTY_DETAILS
  );
  const [bomLines, setBomLines] = useState<BomLineState[]>(
    recipe ? mapRecipeToLines(recipe) : []
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDetailsChange = (newDetails: RecipeDetailsState) => {
    setDetails(newDetails);
    setIsDirty(true);
  };

  const handleBomLinesChange = (newLines: BomLineState[]) => {
    setBomLines(newLines);
    setIsDirty(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setShowDiscardDialog(true);
      return;
    }
    if (!nextOpen) {
      resetWizard();
    }
    onOpenChange(nextOpen);
  };

  const resetWizard = () => {
    setStep(1);
    setDetails(recipe ? mapRecipeToDetails(recipe) : EMPTY_DETAILS);
    setBomLines(recipe ? mapRecipeToLines(recipe) : []);
    setIsDirty(false);
    setShowDiscardDialog(false);
  };

  const handleDiscard = () => {
    resetWizard();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: details.name.trim(),
        description: details.description.trim() || null,
        prep_steps: details.prep_steps.trim() || null,
        cooking_method: details.cooking_method.trim() || null,
        yield_qty: parseFloat(details.yield_qty),
        yield_unit: details.yield_unit,
        portion_size: details.portion_size.trim() || null,
        shelf_life_hours: details.shelf_life_hours ? parseInt(details.shelf_life_hours, 10) : null,
        brand_id: details.brand_id && details.brand_id !== 'none' ? details.brand_id : null,
        zone_id: details.zone_id && details.zone_id !== 'none' ? details.zone_id : null,
        image_url: details.image_url.trim() || null,
        ...(isEditMode && details.status ? { status: details.status } : {}),
        bom_lines: bomLines.map((line) => ({
          input_type: line.input_type,
          item_id: line.item_id,
          quantity: parseFloat(line.quantity),
          unit: line.unit,
          prep_notes: line.prep_notes.trim() || undefined,
        })),
      };

      let savedId: string;
      if (isEditMode && recipe) {
        const updated = await apiClient.patch<Recipe>(`/recipes/${recipe.id}`, payload);
        toast.success('Recipe updated.');
        savedId = updated.id;
      } else {
        const created = await apiClient.post<Recipe>('/recipes', payload);
        toast.success('Recipe created.');
        savedId = created.id;
      }

      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      resetWizard();
      onOpenChange(false);
      onSuccess(savedId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[560px] flex flex-col h-full overflow-hidden">
          <SheetHeader>
            <SheetTitle>{isEditMode ? 'Edit Recipe' : 'Create Recipe'}</SheetTitle>
          </SheetHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-0 px-4 py-3">
            {STEP_LABELS.map((label, i) => {
              const stepNum = (i + 1) as 1 | 2 | 3;
              const isActive = step === stepNum;
              const isCompleted = step > stepNum;
              const isUpcoming = step < stepNum;

              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={[
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
                        isActive
                          ? 'bg-primary border-primary text-primary-foreground'
                          : isCompleted
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-background border-muted-foreground/30 text-muted-foreground',
                      ].join(' ')}
                    >
                      {isCompleted ? <Check className="size-3.5" /> : stepNum}
                    </div>
                    <span
                      className={[
                        'text-xs mt-1 whitespace-nowrap',
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className={[
                        'flex-1 h-px mx-2 mb-4',
                        isCompleted ? 'bg-primary' : 'bg-muted-foreground/20',
                      ].join(' ')}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {step === 1 && (
              <RecipeWizardStep1
                details={details}
                setDetails={handleDetailsChange}
                onNext={() => setStep(2)}
                isEditMode={isEditMode}
              />
            )}
            {step === 2 && (
              <RecipeWizardStep2
                bomLines={bomLines}
                setBomLines={handleBomLinesChange}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <RecipeWizardStep3
                details={details}
                bomLines={bomLines}
                onBack={() => setStep(2)}
                onSubmit={() => void handleSubmit()}
                isSubmitting={isSubmitting}
                computedCost={null}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Discard changes dialog */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. If you close now, your progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDiscardDialog(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
