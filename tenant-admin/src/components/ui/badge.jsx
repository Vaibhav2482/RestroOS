import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
    {
        variants: {
            variant: {
                default: "border-transparent bg-primary/10 text-primary",
                success: "border-transparent bg-success/10 text-success",
                warning: "border-transparent bg-warning/10 text-warning",
                destructive: "border-transparent bg-destructive/10 text-destructive",
                outline: "border-border text-foreground",
                solid: "border-transparent bg-primary text-primary-foreground"
            }
        },
        defaultVariants: {
            variant: "default"
        }
    }
);

function Badge({ className, variant, ...props }) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
