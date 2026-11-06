import type { Facility, FacilityType } from './types'

/** Straight-line (haversine) distance in km. */
export function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

export function nearestOfType(facilities: Facility[], type: FacilityType, lat: number, lon: number) {
  let best: Facility | null = null
  let bestKm = Infinity
  for (const f of facilities) {
    if (f.properties.type !== type) continue
    const [flon, flat] = f.geometry.coordinates
    const d = kmBetween(lat, lon, flat, flon)
    if (d < bestKm) {
      bestKm = d
      best = f
    }
  }
  return best ? { facility: best, km: bestKm } : null
}

/** The town of the closest facility: a readable stand-in for a tract, which has no place name. */
export function nearestTown(facilities: Facility[], lat: number, lon: number): string {
  let best = ''
  let bestKm = Infinity
  for (const f of facilities) {
    const [flon, flat] = f.geometry.coordinates
    const d = kmBetween(lat, lon, flat, flon)
    if (d < bestKm && f.properties.city) {
      bestKm = d
      best = f.properties.city
    }
  }
  return best
}
