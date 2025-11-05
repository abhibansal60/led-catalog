import packageInfo from "../../package.json" assert { type: "json" };

const DEFAULT_BUILD_SUFFIX = "01";
const IST_OFFSET_MINUTES = 330;

const readEnvString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

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

  const ddmmyyyyMatch = trimmed.match(/^(\d{2})[./-]?(\d{2})[./-]?(\d{4})(?:[-_]?(\d{1,2}))?$/);
  if (ddmmyyyyMatch) {
    const [, dd, mm, yyyy, suffix] = ddmmyyyyMatch;
    const yy = yyyy.slice(-2);
    return `${dd}${mm}${yy}-${padBuildSuffix(suffix)}`;
  }

  const ddmmyyMatch = trimmed.match(/^(\d{2})[./-]?(\d{2})[./-]?(\d{2})(?:[-_]?(\d{1,2}))?$/);
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
  const envVersion = readEnvString(import.meta.env.VITE_APP_VERSION);

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

const resolveBuildTimestamp = (): string | null => readEnvString(import.meta.env.VITE_BUILD_TIMESTAMP) ?? null;

const resolveBuildMetadata = (timestamp: string | null): string | null => {
  const commitRef = readEnvString(import.meta.env.VITE_COMMIT_REF);
  const deploymentId = readEnvString(import.meta.env.VITE_DEPLOYMENT_ID);

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
const buildTimestamp = resolveBuildTimestamp();
const buildMetadata = resolveBuildMetadata(buildTimestamp);

const formatTimestampToIstLabel = (value: string): string | null => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const utcMinutes = parsed.getUTCHours() * 60 + parsed.getUTCMinutes();
  const totalMinutes = utcMinutes + IST_OFFSET_MINUTES;
  const minutesInDay = 24 * 60;
  const normalisedMinutes = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalisedMinutes / 60);
  const minutes = normalisedMinutes % 60;

  return `${toTwoDigits(hours)}:${toTwoDigits(minutes)} IST`;
};

const formatVersionForDisplay = (value: string, istTime: string | null): string => {
  const match = value.match(/^(\d{2})(\d{2})(\d{2})-(\d{2})$/);
  if (!match) {
    return value;
  }

  const [, dd, mm, yy, suffix] = match;
  const fullYear = Number.parseInt(yy, 10);
  const century = fullYear >= 70 ? "19" : "20";
  const formattedDate = `${dd}.${mm}.${century}${yy}-${suffix}`;

  return istTime ? `${formattedDate} (${istTime})` : formattedDate;
};

export const APP_VERSION_RAW = baseVersion;
export const APP_VERSION_DETAILS = buildMetadata;
const displayTimestamp = buildTimestamp ?? new Date().toISOString();
const istTime = formatTimestampToIstLabel(displayTimestamp);
export const APP_VERSION = formatVersionForDisplay(baseVersion, istTime);
