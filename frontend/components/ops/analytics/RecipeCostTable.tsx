'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RecipeCostRow } from '@/lib/types/analytics';

interface RecipeCostTableProps {
  data: RecipeCostRow[];
}

export function RecipeCostTable({ data }: RecipeCostTableProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold">Recipe Cost Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recipe cost data available. Ensure recipes have vendor prices.
          </p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipe</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Base Price</TableHead>
                <TableHead className="text-right">Food Cost %</TableHead>
                <TableHead className="text-right">Units Sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const isHighCost = row.food_cost_pct > 40;

                return (
                  <TableRow
                    key={row.recipe_id}
                    className={`cursor-pointer hover:bg-muted/50 ${
                      isHighCost ? 'bg-destructive/5' : ''
                    }`}
                    onClick={() => router.push(`/operations/recipes/${row.recipe_id}`)}
                    title={isHighCost ? 'Food cost exceeds 40% threshold' : undefined}
                  >
                    <TableCell className="font-medium">{row.recipe_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{row.computed_cost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{row.selling_price.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-bold ${
                        isHighCost ? 'text-destructive' : ''
                      }`}
                    >
                      {row.food_cost_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.units_sold}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
