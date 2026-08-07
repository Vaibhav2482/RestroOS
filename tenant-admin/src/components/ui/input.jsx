import { forwardRef } from "react";

import { cn } from "../../lib/utils";

const Input = forwardRef(({ className, type, ...props }, ref) => (
    <input
        ref={ref}
        type={type}
        className={cn(
            "flex h-10 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        {...props}
    />
));

Input.displayName = "Input";

export { Input };
