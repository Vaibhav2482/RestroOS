import { forwardRef } from "react";

import { cn } from "../../lib/utils";

const Textarea = forwardRef(({ className, ...props }, ref) => (
    <textarea
        ref={ref}
        className={cn(
            "flex min-h-[72px] w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        {...props}
    />
));

Textarea.displayName = "Textarea";

export { Textarea };
