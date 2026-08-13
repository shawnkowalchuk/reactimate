/**
 * Human-readable duration for admin stats — compact enough for a table
 * cell. Rounds to two units max ("3h 12m", not "3h 12m 40s") because the
 * numbers are usage estimates, not stopwatch readings.
 *
 * Sub-minute values report as seconds so a brand-new account doesn't read
 * as a flat "0m" and look like tracking is broken.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0s";
  const s = Math.round(totalSeconds);
  if (s < 60) return `${s}s`;

  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) {
    return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}
