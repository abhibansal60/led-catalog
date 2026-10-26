import { Instagram } from "lucide-react";
import { useAppContext } from "./AppContext";

export function AppHeader(): JSX.Element {
  const { handleClearAll } = useAppContext();

  return (
      <header className="sticky top-0 z-10 bg-primary px-4 py-6 text-primary-foreground shadow-md">
        <div className="relative mx-auto flex max-w-4xl flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <button
            type="button"
            className="hidden-troubleshoot-button absolute -top-1 -right-1 text-xs text-primary-foreground/80"
            onClick={handleClearAll}
            aria-label="Clear all data"
          >
            Reset
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Bansal Lights - LED Catalog</h1>
            <p className="text-lg text-primary-foreground/90">अपने LED प्रोग्राम्स यहाँ सेव करें</p>
          </div>
          <a
            href="https://www.instagram.com/bansallights"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 self-center rounded-full border border-primary-foreground/40 bg-primary-foreground/10 px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-foreground/20"
          >
            <Instagram className="h-5 w-5" aria-hidden="true" />
            <span>Follow @bansallights</span>
          </a>
        </div>
      </header>
  );
}
