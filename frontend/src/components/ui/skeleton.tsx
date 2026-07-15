import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Skeleton — reusable glowing loading block for layout transitions
// ---------------------------------------------------------------------------

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ 
  className, 
  ...props 
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-800/40 border border-slate-800/20", 
        className
      )}
      {...props}
    />
  );
}
