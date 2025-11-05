import packageInfo from "../../package.json" assert { type: "json" };

const DEFAULT_BUILD_SUFFIX = "01";

const toTwoDigits = (value: number): string => value.toString().padStart(2, "0");

const formatDateToDdmmyy = (date: Date): string =>
  `${toTwoDigits(date.getDate())}${toTwoDigits(date.getMonth() + 1)}${toTwoDigits(
    date.getFullYear() % 100
  )}`;

const formatIsoToUtcTimestamp = (value: string): string | null => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const yyyy = parsed.getUTCFullYear();
  const mm = toTwoDigits(parsed.getUTCMonth() + 1);
  const dd = toTwoDigits(parsed.getUTCDate());
  const hh = toTwoDigits(parsed.getUTCHours());
  const min = toTwoDigits(parsed.getUTCMinutes());

  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
};

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

const resolveBuildMetadata = (): string | null => {
  const timestamp =
    typeof import.meta.env.VITE_BUILD_TIMESTAMP === "string"
      ? import.meta.env.VITE_BUILD_TIMESTAMP
      : undefined;
  const commitRef =
    typeof import.meta.env.VITE_COMMIT_REF === "string" && import.meta.env.VITE_COMMIT_REF
      ? import.meta.env.VITE_COMMIT_REF
      : undefined;
  const deploymentId =
    typeof import.meta.env.VITE_DEPLOYMENT_ID === "string" && import.meta.env.VITE_DEPLOYMENT_ID
      ? import.meta.env.VITE_DEPLOYMENT_ID
      : undefined;

  const parts: string[] = [];

  if (timestamp) {
    const formattedTimestamp = formatIsoToUtcTimestamp(timestamp);
    if (formattedTimestamp) {
      parts.push(`deployed ${formattedTimestamp}`);
    }
  }

  if (commitRef) {
    parts.push(`commit ${commitRef.slice(0, 7)}`);
  }

  if (deploymentId) {
    parts.push(
      deploymentId.length > 12
        ? `deploy ${deploymentId.slice(0, 12)}…`
        : `deploy ${deploymentId}`
    );
  }

  return parts.length ? parts.join(" • ") : null;
};

const baseVersion = resolveVersionSource() ?? buildFallbackVersion();
const buildMetadata = resolveBuildMetadata();

export const APP_VERSION = buildMetadata ? `${baseVersion} (${buildMetadata})` : baseVersion;
