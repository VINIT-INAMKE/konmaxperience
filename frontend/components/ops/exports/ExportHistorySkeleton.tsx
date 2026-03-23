import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';

export function ExportHistorySkeleton() {
  return (
    <TableBody>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-24 rounded" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-14 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32 rounded" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-14 rounded" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20 rounded" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20 rounded" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8 rounded" />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}
