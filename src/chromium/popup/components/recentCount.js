export const RECENT_COUNT_MIN = 1;
export const RECENT_COUNT_MAX = 100;

export const clampRecentCount = (value, fallback = 30) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(RECENT_COUNT_MAX, Math.max(RECENT_COUNT_MIN, parsed));
};

export const isValidRecentCount = (value) => {
  if (String(value).trim() === '') return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= RECENT_COUNT_MIN && parsed <= RECENT_COUNT_MAX;
};
