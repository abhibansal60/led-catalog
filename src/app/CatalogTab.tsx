import { FolderOpen, LayoutGrid, List, Trash2 } from "lucide-react";
import { BilingualText } from "@/components/BilingualText";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppContext } from "./AppContext";
import { ProgramItem } from "./ProgramItem";

export function CatalogTab(): JSX.Element {
  const {
    programs,
    isGridView,
    setCatalogView,
    isListView,
    searchTerm,
    setSearchTerm,
    isLoadingPrograms,
    hasPrograms,
    hasFilteredPrograms,
    filteredPrograms,
    trimmedSearchTerm,
    setActiveTab,
    handleClearAll,
  } = useAppContext();

  return (
          <section
            id="catalog-view-panel"
            role="tabpanel"
            aria-labelledby="catalog-view-tab"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <h2 className="text-2xl font-semibold">
                  <BilingualText
                    primary="Saved Programs"
                    secondary="सेव किए गए प्रोग्राम"
                    align="start"
                    className="items-start"
                  />
                </h2>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  <span>Total Programs: {programs.length}</span>
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden text-sm font-medium text-muted-foreground sm:inline">Layout:</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isGridView ? "primary" : "ghost"}
                      aria-pressed={isGridView}
                      onClick={() => setCatalogView("grid")}
                      className="px-3"
                    >
                      <LayoutGrid className="h-5 w-5" aria-hidden="true" />
                      <span className="hidden sm:inline">Grid</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={isListView ? "primary" : "ghost"}
                      aria-pressed={isListView}
                      onClick={() => setCatalogView("list")}
                      className="px-3"
                    >
                      <List className="h-5 w-5" aria-hidden="true" />
                      <span className="hidden sm:inline">List</span>
                    </Button>
                  </div>
                </div>
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name or description"
                  className="w-full sm:w-64"
                  aria-label="Search programs"
                />
              </div>
            </div>
            {isLoadingPrograms ? (
              <Card className="border border-dashed border-border bg-card text-muted-foreground">
                <CardContent className="space-y-4 py-10 text-center text-base">
                  <p>Loading catalog… कैटलॉग लोड हो रहा है…</p>
                </CardContent>
              </Card>
            ) : hasPrograms ? (
              hasFilteredPrograms ? (
                <div
                  className={
                    isGridView
                      ? "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                      : "flex flex-col gap-5"
                  }
                >
                  {filteredPrograms.map((program) => (
                    <ProgramItem key={program.id} program={program} />
                  ))}
                </div>
              ) : (
                <Card className="border border-dashed border-border bg-card text-muted-foreground">
                  <CardContent className="space-y-4 py-10 text-center text-base">
                    <p className="text-xl text-foreground">कोई परिणाम नहीं मिला।</p>
                    <p>
                      "{trimmedSearchTerm}" के लिए कोई प्रोग्राम नहीं मिला। स्पेलिंग बदलकर देखें।
                    </p>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card className="border border-dashed border-border bg-card text-muted-foreground">
                <CardContent className="space-y-4 py-10 text-center text-base">
                  <p className="text-xl text-foreground">💡 अभी कोई प्रोग्राम सेव नहीं है।</p>
                  <p>
                    नीचे वाले बटन से नया प्रोग्राम जोड़ें। फाइल डाउनलोड करके SD कार्ड में कॉपी करें।
                  </p>
                  <Button type="button" onClick={() => setActiveTab("add")} className="flex-col gap-1">
                    <span aria-hidden="true" className="text-2xl">➕</span>
                    <BilingualText primary="Add Program" secondary="नया जोड़ें" />
                  </Button>
                </CardContent>
              </Card>
            )}
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 focus-visible:ring-red-600"
                onClick={handleClearAll}
                title="Delete Everything (Dangerous)"
                aria-label="Delete everything (dangerous)"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Everything
              </Button>
            </div>
          </section>
  );
}
