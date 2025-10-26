import React from "react";

import { cn } from "@/lib/utils";

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

// Basic label helper that keeps type and spacing consistent.
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label({ className, ...props }, ref) {
  return <label ref={ref} className={cn("text-lg font-medium text-foreground", className)} {...props} />;
});

Label.displayName = "Label";

export { Label };
