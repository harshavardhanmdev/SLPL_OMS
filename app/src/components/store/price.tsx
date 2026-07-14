import { formatINR } from "@/lib/money";
import { discountPercent } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function Price({
  amount,
  mrp,
  className,
  size = "md",
}: {
  amount: number;
  mrp?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const off = mrp ? discountPercent(mrp, amount) : 0;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span
        className={cn(
          "font-heading font-bold",
          size === "sm" && "text-base",
          size === "md" && "text-lg",
          size === "lg" && "text-3xl",
        )}
      >
        {formatINR(amount)}
      </span>
      {off > 0 && (
        <>
          <span className={cn("text-muted-foreground line-through", size === "lg" ? "text-base" : "text-xs")}>
            {formatINR(mrp!)}
          </span>
          <span className={cn("font-semibold text-green-700 dark:text-green-400", size === "lg" ? "text-sm" : "text-xs")}>
            {off}% off
          </span>
        </>
      )}
    </div>
  );
}
