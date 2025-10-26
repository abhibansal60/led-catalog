import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper used across shadcn components to merge tailwind class names safely.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
