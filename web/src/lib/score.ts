import type { Meta, TractProps } from './types'
import { kmBetween } from './geo'

export type FactorKey =
  | 'p_women' | 'p_poverty' | 'p_uninsured' | 'p_transport' | 'p_mammo_gap'
  | 'p_far_hc' | 'p_far_fp' | 'p_far_birth' | 'p_far_mammo'

export interface Factor {
  key: FactorKey
  label: string
  hint: string
  group: 'Need' | 'Distance to care'
}

export const FACTORS: Factor[] = [
  { key: 'p_women', label: 'Number of women', hint: 'More women living in the tract', group: 'Need' },
  { key: 'p_poverty', label: 'Poverty', hint: 'Share of residents below the poverty line', group: 'Need' },
  { key: 'p_uninsured', label: 'Uninsured adults', hint: 'Share of adults 18–64 without insurance', group: 'Need' },
  { key: 'p_transport', label: 'No reliable transportation', hint: 'Share of adults without a reliable way to get around', group: 'Need' },
  { key: 'p_mammo_gap', label: 'Low mammogram screening', hint: 'Fewer women 50–74 getting mammograms', group: 'Need' },
  { key: 'p_far_hc', label: 'Far from a health center', hint: 'Distance to the nearest community health center', group: 'Distance to care' },
  { key: 'p_far_fp', label: 'Far from family planning', hint: 'Distance to the nearest family planning clinic', group: 'Distance to care' },
  { key: 'p_far_birth', label: 'Far from a birthing hospital', hint: 'Distance to the nearest hospital that delivers babies', group: 'Distance to care' },
  { key: 'p_far_mammo', label: 'Far from mammography', hint: 'Distance to the nearest mammography site', group: 'Distance to care' },
]

export type Weights = Record<FactorKey, number>

const w = (v: Partial<Weights>): Weights => ({
  p_women: 1, p_poverty: 1, p_uninsured: 1, p_transport: 1, p_mammo_gap: 1,
  p_far_hc: 1, p_far_fp: 1, p_far_birth: 1, p_far_mammo: 1, ...v,
})

/** One line per preset saying which places it favors. */
export const PRESET_INFO: Record<string, string> = {
  "All women's care": 'Looks at every need factor, with extra weight on where the most women live.',
  'Prenatal & postpartum': 'Favors places far from a hospital that delivers babies, with many uninsured women and little transportation.',
  'Cancer screening': 'Favors places with low mammogram rates that are far from mammography.',
  'Birth control & family planning': 'Favors low-income places far from a family planning clinic.',
}

/** The default "care you'll offer" option. */
export const DEFAULT_PRESET = "All women's care"

/** "Care you'll offer": each option weighs the need factors that matter for that kind of care. */
export const PRESETS: Record<string, Weights> = {
  "All women's care": w({ p_women: 2 }),
  'Prenatal & postpartum': w({ p_women: 2, p_uninsured: 2, p_transport: 2, p_far_birth: 3, p_mammo_gap: 0, p_far_mammo: 0 }),
  'Cancer screening': w({ p_mammo_gap: 3, p_far_mammo: 2, p_uninsured: 2, p_far_birth: 0 }),
  'Birth control & family planning': w({ p_far_fp: 3, p_poverty: 2, p_uninsured: 2, p_far_birth: 0, p_far_mammo: 0, p_mammo_gap: 0 }),
}

/** Weighted mean of percentile ranks, 0 (least need) to 1 (most need). Null for unrankable tracts. */
export function scoreTract(t: TractProps, weights: Weights): number | null {
  if (!t.rankable) return null
  let sum = 0
  let total = 0
  for (const f of FACTORS) {
    const p = t[f.key]
    const wt = weights[f.key]
    if (p == null || wt === 0) continue
    sum += p * wt
    total += wt
  }
  return total ? sum / total : null
}

/** Highest-scoring tracts, skipping any within `spacingKm` of one already picked so the list isn't one cluster. */
export function topSites(tracts: TractProps[], n = 10, spacingKm = 8): TractProps[] {
  const sorted = tracts.filter((t) => t.score != null).sort((a, b) => b.score! - a.score!)
  const picked: TractProps[] = []
  for (const t of sorted) {
    if (picked.some((p) => kmBetween(p.lat, p.lon, t.lat, t.lon) < spacingKm)) continue
    picked.push(t)
    if (picked.length === n) break
  }
  return picked
}

const pct = (v: number | null) => (v == null ? '–' : `${v.toFixed(0)}%`)
const km = (v: number) => `~${v < 10 ? v.toFixed(1) : v.toFixed(0)} km`
export const fmtInt = (v: number | null) => (v == null ? '–' : Math.round(v).toLocaleString())

function phrase(key: FactorKey, t: TractProps, meta: Meta): string {
  const a = meta.state_avg
  switch (key) {
    case 'p_women': return `${fmtInt(t.women_total)} women live here`
    case 'p_poverty': return `${pct(t.poverty_pct)} below poverty (CA ${pct(a.poverty_pct)})`
    case 'p_uninsured': return `${pct(t.uninsured_pct)} of adults uninsured (CA ${pct(a.uninsured_pct)})`
    case 'p_transport': return `${pct(t.no_transport_pct)} lack reliable transportation (CA ${pct(a.no_transport_pct)})`
    case 'p_mammo_gap': return `mammogram screening ${pct(t.mammo_pct)} vs ${pct(a.mammo_pct)} statewide`
    case 'p_far_hc': return `nearest health center ${km(t.km_health_center)}`
    case 'p_far_fp': return `nearest family planning clinic ${km(t.km_family_planning)}`
    case 'p_far_birth': return `nearest birthing hospital ${km(t.km_birthing_hospital)}`
    case 'p_far_mammo': return `nearest mammography ${km(t.km_mammography)}`
  }
}

/** Plain-language reason: the three factors contributing most to this tract's score. */
export function reasons(t: TractProps, weights: Weights, meta: Meta): string[] {
  return FACTORS
    .filter((f) => weights[f.key] > 0 && t[f.key] != null)
    .map((f) => ({ f, c: (t[f.key] as number) * weights[f.key] }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
    .map(({ f }) => phrase(f.key, t, meta))
}

/** What kind of site fits, using what a community health center can provide itself vs. refer out. */
export function recommendation(t: TractProps): string[] {
  const out: string[] = []
  if (t.km_health_center < 3) {
    out.push('A health center is already nearby. Partnering with it to expand women\'s services may beat opening a new site.')
  } else if ((t.women_total ?? 0) < 1500) {
    out.push('Small population: a part-time satellite or mobile clinic fits better than a full-time site.')
  } else {
    out.push('Open a women\'s health site: well-woman exams, birth control, Pap/HPV tests, STI testing, prenatal and postpartum care.')
  }
  if (t.county_no_birthing || t.km_birthing_hospital > 30) {
    out.push('No birthing hospital close by: offer prenatal care locally with a hospital transfer agreement, plus telehealth check-ins.')
  }
  if (t.km_mammography > 20) {
    out.push('Mammography is far away: schedule a mobile mammography van on set days.')
  }
  return out
}
