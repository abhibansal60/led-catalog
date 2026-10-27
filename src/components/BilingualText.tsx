import { cn } from "@/lib/utils";

type BilingualTextProps = {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  align?: "start" | "center";
  className?: string;
  secondaryClassName?: string;
};

export function BilingualText({
  primary,
  secondary,
  align = "center",
  className,
  secondaryClassName,
}: BilingualTextProps): JSX.Element {
  return (
    <span
      className={cn(
        "flex flex-col leading-tight",
        align === "start" ? "items-start text-left" : "items-center text-center",
        className
      )}
    >
      <span>{primary}</span>
      {secondary ? (
        <span className={cn("text-sm font-normal text-muted-foreground", secondaryClassName)}>{secondary}</span>
      ) : null}
    </span>
  );
}
