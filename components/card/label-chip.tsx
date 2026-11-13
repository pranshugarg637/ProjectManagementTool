import { labelClasses } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function LabelChip({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
        labelClasses(label),
        className,
      )}
    >
      {label}
      {children}
    </span>
  );
}
