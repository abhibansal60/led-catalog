import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Central place to describe button look & feel for the catalog.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 active:translate-y-[1px]",
  {
    variants: {
      variant: {
        primary: "bg-bansalBlue text-white hover:bg-bansalBlue-light focus-visible:ring-bansalBlue",
        secondary:
          "bg-white text-bansalBlue border-2 border-bansalBlue hover:bg-bansalBlue/10 focus-visible:ring-bansalBlue",
        success: "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600",
        destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
        ghost: "bg-transparent text-bansalBlue hover:bg-bansalBlue/10",
      },
      size: {
        default: "h-14 px-6",
        sm: "h-10 px-4 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariants;

// Lightweight wrapper that renders a <button> with the variant styles merged in.
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref
) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});

Button.displayName = "Button";

export { Button, buttonVariants };
