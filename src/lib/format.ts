/**
 * 표시용 포맷터. 통화·기간 등.
 */

export function formatKrw(krw: number | null | undefined): string {
  if (krw == null) return "미기재";
  if (krw >= 100_000_000) return `${(krw / 100_000_000).toFixed(1)}억원`;
  if (krw >= 10_000) return `${Math.round(krw / 10_000).toLocaleString()}만원`;
  return `${krw.toLocaleString()}원`;
}

export function formatRateRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min == null && max == null) return "미기재";
  if (min == null) return `~${max}%`;
  if (max == null || min === max) return `${min}%`;
  return `${min}~${max}%`;
}

export function formatAgeRange(
  min: number | null,
  max: number | null,
): string {
  if (min == null && max == null) return "연령 무관";
  if (min == null) return `~${max}세`;
  if (max == null) return `${min}세~`;
  return `${min}~${max}세`;
}
