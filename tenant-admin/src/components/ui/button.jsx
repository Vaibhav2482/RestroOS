import { forwardRef } from "react";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md active:scale-[0.98]",
                outline: "border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
                ghost: "text-foreground hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
                destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]",
                soft: "bg-primary/10 text-primary hover:bg-primary/15 active:scale-[0.98]"
            },
            size: {
                default: "h-10 px-4",
                sm: "h-8 px-3 text-xs",
                lg: "h-14 px-6 text-base",
                icon: "h-9 w-9"
            }
        },
        defaultVariants: {
            variant: "default",
            size: "default"
        }
    }
);

const Button = forwardRef(({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));

Button.displayName = "Button";

export { Button, buttonVariants };
