/**
 * Coordinate hygiene shared by the browser and the Next.js proxy.
 *
 * navigator.geolocation returns doubles such as 25.204849312345678. The FastAPI backend stores latitude/longitude as
 * Decimal fields limited to 10 digits in total, so anything longer is rejected with
 * "Decimal input should have no more than 10 digits in total" (shift start/end and every queued incident / stop update).
 * 6 decimal places is about 0.11 m, far more precise than a phone GPS fix, and always fits (3 + 6 = 9 digits).
 */
export const roundTo = (v: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};
export const roundCoord = (v: number): number => roundTo(v, 6);

const COORD_KEY = /(^|_)(latitude|longitude|lat|lng|lon)$/i;
const ACCURACY_KEY = /(^|_)(gps_)?accuracy(_meters|_m)?$/i;

/** Returns a copy of `value` with every latitude/longitude number rounded to 6 decimals and accuracy to 1 decimal. */
export function sanitizeCoords<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => sanitizeCoords(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[k] = COORD_KEY.test(k) ? roundCoord(v) : ACCURACY_KEY.test(k) ? roundTo(v, 1) : v;
      } else {
        out[k] = sanitizeCoords(v);
      }
    }
    return out as T;
  }
  return value;
}
