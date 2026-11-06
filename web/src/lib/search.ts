import type { Facility, TractProps } from './types'
import { kmBetween } from './geo'

/** A place the planner can type: a ZIP code, a town, or a county. */
export interface Place {
  kind: 'ZIP code' | 'Town' | 'County'
  label: string
  sub: string
  lat: number
  lon: number
  /** The tract nearest the place's center, used to seed the site plan. */
  tract: string
}

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

function center(points: { lat: number; lon: number; w: number }[]) {
  const w = points.reduce((s, p) => s + p.w, 0) || points.length
  return {
    lat: points.reduce((s, p) => s + p.lat * (p.w || 1), 0) / w,
    lon: points.reduce((s, p) => s + p.lon * (p.w || 1), 0) / w,
  }
}

function nearestTract(tracts: TractProps[], lat: number, lon: number) {
  let best = tracts[0]
  let d = Infinity
  for (const t of tracts) {
    if (!t.rankable) continue
    const k = kmBetween(lat, lon, t.lat, t.lon)
    if (k < d) { d = k; best = t }
  }
  return best
}

export function buildPlaces(tracts: TractProps[], facilities: Facility[], countyName: (f: string) => string): Place[] {
  const places: Place[] = []
  const group = <T,>(items: T[], key: (x: T) => string | null) => {
    const m = new Map<string, T[]>()
    for (const x of items) { const k = key(x); if (k) m.set(k, [...(m.get(k) ?? []), x]) }
    return m
  }
  for (const [zip, ts] of group(tracts, (t) => t.zcta)) {
    const c = center(ts.map((t) => ({ lat: t.lat, lon: t.lon, w: t.women_total ?? 0 })))
    places.push({ kind: 'ZIP code', label: zip, sub: `${countyName(ts[0].county_fips)} County`, ...c, tract: nearestTract(ts, c.lat, c.lon).GEOID })
  }
  for (const [city, fs] of group(facilities, (f) => (f.properties.city ? title(f.properties.city.trim()) : null))) {
    const c = center(fs.map((f) => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], w: 1 })))
    const t = nearestTract(tracts, c.lat, c.lon)
    places.push({ kind: 'Town', label: city, sub: `${countyName(t.county_fips)} County`, ...c, tract: t.GEOID })
  }
  for (const [fips, ts] of group(tracts, (t) => t.county_fips)) {
    const c = center(ts.map((t) => ({ lat: t.lat, lon: t.lon, w: t.women_total ?? 0 })))
    places.push({ kind: 'County', label: `${countyName(fips)} County`, sub: 'California', ...c, tract: nearestTract(ts, c.lat, c.lon).GEOID })
  }
  return places
}

export function searchPlaces(places: Place[], q: string, n = 7): Place[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const score = (p: Place) => {
    const l = p.label.toLowerCase()
    if (l === s) return 0
    if (l.startsWith(s)) return 1 + (p.kind === 'Town' ? 0 : p.kind === 'County' ? 0.1 : 0.2)
    if (l.includes(s)) return 3
    return Infinity
  }
  return places.map((p) => ({ p, k: score(p) })).filter((x) => x.k < Infinity).sort((a, b) => a.k - b.k || a.p.label.localeCompare(b.p.label))
    .slice(0, n).map((x) => x.p)
}
