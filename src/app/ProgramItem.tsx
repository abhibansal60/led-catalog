import {
  Program,
  formatControllerLabel,
  formatFileSize,
  getProgramController,
} from "@/lib/catalog";
import { useAppContext } from "./AppContext";
import { ProgramGridCard } from "./ProgramGridCard";
import { ProgramListCard } from "./ProgramListCard";

function useProgramItem(program: Program) {
  const { copyStatuses, directoryPermission } = useAppContext();
    const copyStatus = copyStatuses[program.id];
    const isCopying = copyStatus?.status === "copying";
    const isFileMissing = program.isFileMissing === true;
    const formattedFileSize =
      program.fileSizeBytes !== undefined && program.fileSizeBytes !== null
        ? formatFileSize(program.fileSizeBytes)
        : null;
    const sizeDisplay = isFileMissing
      ? "Link LED file to view size"
      : formattedFileSize ??
        (directoryPermission === "granted"
          ? "Size unavailable"
          : "Connect folder to view size");
    const controllerLabel = formatControllerLabel(getProgramController(program));
    const copyPrimaryLabel = isCopying
      ? "Copying…"
      : isFileMissing
      ? "Link LED file first"
      : "Format & Copy to SD Card";
    const copySecondaryLabel = isCopying
      ? "कॉपी जारी…"
      : isFileMissing
      ? "पहले LED फाइल जोड़ें"
      : "SD कार्ड फॉर्मेट करके कॉपी करें";
    const downloadPrimaryLabel = isFileMissing ? "LED file missing" : "Download";
    const downloadSecondaryLabel = isFileMissing ? "LED फाइल नहीं मिली" : "डाउनलोड";

  return {
    copyStatus,
    isCopying,
    isFileMissing,
    formattedFileSize,
    sizeDisplay,
    controllerLabel,
    copyPrimaryLabel,
    copySecondaryLabel,
    downloadPrimaryLabel,
    downloadSecondaryLabel,
  };
}

export type ProgramItemValues = ReturnType<typeof useProgramItem>;

export function ProgramItem({ program }: { program: Program }): JSX.Element {
  const { isGridView } = useAppContext();
  const item = useProgramItem(program);
  return isGridView ? (
    <ProgramGridCard program={program} item={item} />
  ) : (
    <ProgramListCard program={program} item={item} />
  );
}
