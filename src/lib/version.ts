import packageInfo from "../../package.json" assert { type: "json" };

const DEFAULT_BUILD_SUFFIX = "01";

const toTwoDigits = (value: number): string => value.toString().padStart(2, "0");

const formatDateToDdmmyy = (date: Date): string =>
  `${toTwoDigits(date.getDate())}${toTwoDigits(date.getMonth() + 1)}${toTwoDigits(
    date.getFullYear() % 100
  )}`;

const padBuildSuffix = (suffix: string | undefined): string =>
  (suffix ?? DEFAULT_BUILD_SUFFIX).padStart(2, "0");

const normaliseDatedInput = (input: string): string | null => {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const ddmmyyMatch = trimmed.match(/^(\d{2})(\d{2})(\d{2})(?:[-_]?(\d{1,2}))?$/);
  if (ddmmyyMatch) {
    const [, dd, mm, yy, suffix] = ddmmyyMatch;
    return `${dd}${mm}${yy}-${padBuildSuffix(suffix)}`;
  }

  const isoLikeMatch = trimmed.match(/^(\d{4})[./-]?(\d{2})[./-]?(\d{2})(?:[-_]?(\d{1,2}))?$/);
  if (isoLikeMatch) {
    const [, yyyy, mm, dd, suffix] = isoLikeMatch;
    const yy = yyyy.slice(-2);
    return `${dd}${mm}${yy}-${padBuildSuffix(suffix)}`;
  }

  return null;
};

const resolveVersionSource = (): string | null => {
  const envVersion =
    typeof import.meta.env.VITE_APP_VERSION === "string"
      ? import.meta.env.VITE_APP_VERSION
      : undefined;

  const candidateSources = [
    envVersion,
    typeof packageInfo.appVersion === "string" ? packageInfo.appVersion : undefined,
    typeof packageInfo.version === "string" ? packageInfo.version : undefined,
  ];

  for (const candidate of candidateSources) {
    if (!candidate) {
      continue;
    }

    const formatted = normaliseDatedInput(candidate);
    if (formatted) {
      return formatted;
    }
  }

  return null;
};

const buildFallbackVersion = (): string => `${formatDateToDdmmyy(new Date())}-${DEFAULT_BUILD_SUFFIX}`;

export const APP_VERSION = resolveVersionSource() ?? buildFallbackVersion();
