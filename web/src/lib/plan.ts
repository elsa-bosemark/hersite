import type { TractProps } from './types'
import type { ProgramId } from './programs'
import { kmBetween } from './geo'

/** A health center's plan for one new site, built step by step and saved in the browser. */
export interface SitePlan {
  id: string
  name: string
  /** The funding program the evidence is organized for. Older plans have none and were HRSA. */
  program?: ProgramId
  org: string
  tract: string
  createdAt: string
  step: number
  radiusKm: number
  zips: string[]
  site: { lat: number; lon: number; address: string }
  hours: string
  /** Estimated clients per year at the site (Title X asks for this per site). */
  clients?: string
  /** Snapshot of the mini map for the report's coverage map, as a JPEG data URL. */
  coverageMap?: string
  narrative: string
  /** Factors HerSite has no data for, filled in by the planner. */
  localData: Record<string, { value: string; source: string }>
  spaces: Record<string, { status: SpaceStatus; note: string }>
  chosenSpace: string | null
  partners: Record<string, { status: PartnerStatus; date: string; note: string }>
  customPartners: { id: string; name: string; kind: string }[]
}

export type SpaceStatus = 'Not started' | 'Researching' | 'Contacted' | 'Toured' | 'Offer made'
export const SPACE_STATUSES: SpaceStatus[] = ['Not started', 'Researching', 'Contacted', 'Toured', 'Offer made']
export type PartnerStatus = 'Not asked' | 'Requested' | 'Received' | 'Declined' | 'No reply'
export const PARTNER_STATUSES: PartnerStatus[] = ['Not asked', 'Requested', 'Received', 'Declined', 'No reply']

export const STEPS = [
  { title: 'Service area', req: 'HRSA ch. 3', doc: 'ZIP code list' },
  { title: 'Unmet need', req: 'HRSA ch. 3', doc: 'Needs assessment brief' },
  { title: 'Site & access', req: 'HRSA ch. 6', doc: 'Access summary' },
  { title: 'Space', req: 'Form 5B', doc: 'Space shortlist' },
  { title: 'Partners & letters', req: 'HRSA ch. 14', doc: 'Collaboration log' },
  { title: 'Application packet', req: 'All', doc: 'Full packet' },
] as const

const KEY = 'hersite.plans'

export function loadPlans(): SitePlan[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function savePlans(plans: SitePlan[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plans))
  } catch { /* storage unavailable: plans last for this visit only */ }
}

/** ZIP codes whose tracts have their center within `km` of a point. */
export function zipsNear(tracts: TractProps[], lat: number, lon: number, km: number): string[] {
  const zips = new Set<string>()
  for (const t of tracts) if (t.zcta && kmBetween(lat, lon, t.lat, t.lon) <= km) zips.add(t.zcta)
  return [...zips].sort()
}

export function newPlan(t: TractProps, tracts: TractProps[], name: string, at?: { lat: number; lon: number }, program: ProgramId = 'titlex'): SitePlan {
  const radiusKm = 15
  const { lat, lon } = at ?? t
  return {
    id: crypto.randomUUID(), name, program, org: '', tract: t.GEOID, createdAt: new Date().toISOString(), step: 0,
    radiusKm, zips: zipsNear(tracts, lat, lon, radiusKm),
    site: { lat, lon, address: '' }, hours: '', narrative: '',
    localData: {}, spaces: {}, chosenSpace: null, partners: {}, customPartners: [],
  }
}

/** Population-weighted summary of a set of tracts (the service area, a county, or the state). */
export interface AreaStats {
  tracts: number
  pop: number
  women: number
  women15to44: number
  women45to64: number
  /** Estimated women 15–44 in households under 200% of poverty (Title X and Family PACT priority). */
  lowIncomeWomen: number
  values: Record<string, number | null>
}

// Each percentage is averaged using the population it describes.
const WEIGHTS: Record<string, (t: TractProps) => number> = {
  poverty_pct: (t) => t.pop_total ?? 0,
  limited_english_pct: (t) => t.pop_total ?? 0,
  uninsured_pct: (t) => t.pop_total ?? 0,
  no_transport_pct: (t) => t.pop_total ?? 0,
  housing_insecure_pct: (t) => t.pop_total ?? 0,
  checkup_pct: (t) => t.pop_total ?? 0,
  diabetes_pct: (t) => t.pop_total ?? 0,
  bphigh_pct: (t) => t.pop_total ?? 0,
  depression_pct: (t) => t.pop_total ?? 0,
  obesity_pct: (t) => t.pop_total ?? 0,
  food_insecure_pct: (t) => t.pop_total ?? 0,
  under100_pct: (t) => t.pop_total ?? 0,
  under200_pct: (t) => t.pop_total ?? 0,
  mammo_pct: (t) => t.women_45_64 ?? 0,
  km_health_center: (t) => t.women_total ?? 0,
  km_family_planning: (t) => t.women_total ?? 0,
  km_birthing_hospital: (t) => t.women_total ?? 0,
  km_mammography: (t) => t.women_total ?? 0,
}

export function summarize(tracts: TractProps[]): AreaStats {
  const values: Record<string, number | null> = {}
  for (const [k, wf] of Object.entries(WEIGHTS)) {
    let sum = 0
    let wsum = 0
    for (const t of tracts) {
      const v = t[k as keyof TractProps] as number | null
      const w = wf(t)
      if (v == null || !w) continue
      sum += v * w
      wsum += w
    }
    values[k] = wsum ? sum / wsum : null
  }
  const total = (f: (t: TractProps) => number | null) => tracts.reduce((s, t) => s + (f(t) ?? 0), 0)
  return {
    tracts: tracts.length, pop: total((t) => t.pop_total), women: total((t) => t.women_total),
    women15to44: total((t) => t.women_15_44), women45to64: total((t) => t.women_45_64),
    lowIncomeWomen: total((t) => (t.women_15_44 ?? 0) * ((t.under200_pct ?? 0) / 100)), values,
  }
}

/** A row in the needs assessment, grouped by the factors HRSA Compliance Manual ch. 3 names. */
export interface NeedRow {
  group: string
  label: string
  key?: string
  /** When set, HerSite has no data and the planner can enter a local value. */
  missing?: string
  unit?: '%' | 'km' | 'count'
  source: string
}

export const NEED_ROWS: NeedRow[] = [
  { group: 'Demographics', label: 'Total population', key: 'pop', unit: 'count', source: 'Census ACS 2019–23' },
  { group: 'Demographics', label: 'Women (all ages)', key: 'women', unit: 'count', source: 'Census ACS 2019–23' },
  { group: 'Demographics', label: 'Women 15–44', key: 'women15to44', unit: 'count', source: 'Census ACS 2019–23' },
  { group: 'Demographics', label: 'Low-income women 15–44 (est.)', key: 'lowIncomeWomen', unit: 'count', source: 'Census ACS 2019–23, under 200% of poverty' },
  { group: 'Economic factors', label: 'Below poverty', key: 'poverty_pct', unit: '%', source: 'Census ACS 2019–23' },
  { group: 'Economic factors', label: 'Below 200% of poverty (Family PACT eligible)', key: 'under200_pct', unit: '%', source: 'Census ACS 2019–23' },
  { group: 'Economic factors', label: 'Adults 18–64 uninsured', key: 'uninsured_pct', unit: '%', source: 'CDC PLACES 2023' },
  { group: 'Access barriers', label: 'No reliable transportation', key: 'no_transport_pct', unit: '%', source: 'CDC PLACES 2023' },
  { group: 'Access barriers', label: 'Education attainment', missing: 'e.g., % of adults without a high school diploma', source: '' },
  { group: 'Health status', label: 'Mammogram use, women 50–74', key: 'mammo_pct', unit: '%', source: 'CDC PLACES 2022' },
  { group: 'Health status', label: 'Routine checkup in past year', key: 'checkup_pct', unit: '%', source: 'CDC PLACES 2023' },
  { group: 'Health status', label: 'Diabetes', key: 'diabetes_pct', unit: '%', source: 'CDC PLACES 2023' },
  { group: 'Health status', label: 'High blood pressure', key: 'bphigh_pct', unit: '%', source: 'CDC PLACES 2023' },
  { group: 'Health status', label: 'Depression', key: 'depression_pct', unit: '%', source: 'CDC PLACES 2023' },
  { group: 'Health status', label: 'Obesity', key: 'obesity_pct', unit: '%', source: 'CDC PLACES 2023' },
  { group: 'Health status', label: 'Infant mortality or low birth weight', missing: 'e.g., county rate from CDPH vital statistics', source: '' },
  { group: 'Available care', label: 'Distance to nearest health center', key: 'km_health_center', unit: 'km', source: 'HRSA sites, straight-line' },
  { group: 'Available care', label: 'Distance to nearest family planning clinic', key: 'km_family_planning', unit: 'km', source: 'CA Family PACT, straight-line' },
  { group: 'Available care', label: 'Distance to nearest birthing hospital', key: 'km_birthing_hospital', unit: 'km', source: 'CA HCAI 2025, straight-line' },
  { group: 'Available care', label: 'Distance to nearest mammography', key: 'km_mammography', unit: 'km', source: 'FDA MQSA, straight-line' },
  { group: 'Available care', label: 'OB/GYN and primary care providers per resident', missing: 'e.g., providers per 10,000 people (HRSA Area Health Resources File)', source: '' },
  { group: 'Unique needs', label: 'Limited-English households', key: 'limited_english_pct', unit: '%', source: 'Census ACS 2019–23' },
  { group: 'Unique needs', label: 'Housing insecurity', key: 'housing_insecure_pct', unit: '%', source: 'CDC PLACES 2023' },
  { group: 'Unique needs', label: 'Food insecurity', key: 'food_insecure_pct', unit: '%', source: 'CDC PLACES 2023' },
]

export function statValue(s: AreaStats, key: string): number | null {
  if (key === 'pop') return s.pop
  if (key === 'women') return s.women
  if (key === 'women15to44') return s.women15to44
  if (key === 'lowIncomeWomen') return s.lowIncomeWomen
  return s.values[key] ?? null
}

export function fmtStat(v: number | null, unit?: NeedRow['unit']): string {
  if (v == null) return '–'
  if (unit === 'count') return Math.round(v).toLocaleString()
  if (unit === 'km') return `${v.toFixed(1)} km`
  return `${v.toFixed(1)}%`
}

/** A first-draft paragraph for the needs assessment, written from the service area's numbers. */
export function draftNarrative(area: AreaStats, state: AreaStats, countyNames: string[], zips: string[]): string {
  const v = area.values
  // Same population-weighted state figures as the needs table, so the paragraph and table agree.
  const a = Object.fromEntries(Object.entries(state.values).map(([k, x]) => [k, x ?? 0])) as Record<string, number>
  const parts: string[] = []
  parts.push(`The proposed service area covers ${zips.length} ZIP code${zips.length === 1 ? '' : 's'} in ${countyNames.join(' and ')} ${countyNames.length === 1 ? 'County' : 'Counties'}, home to ${Math.round(area.pop).toLocaleString()} people, including ${Math.round(area.women).toLocaleString()} women and ${Math.round(area.women15to44).toLocaleString()} women of reproductive age (15–44).`)
  if (area.lowIncomeWomen > 0) parts.push(`An estimated ${Math.round(area.lowIncomeWomen).toLocaleString()} women 15–44 live in households below 200% of the federal poverty level, the income limit for California's Family PACT program.`)
  const gaps: string[] = []
  if (v.poverty_pct != null && v.poverty_pct > a.poverty_pct) gaps.push(`${v.poverty_pct.toFixed(1)}% of residents live below the poverty line (California: ${a.poverty_pct.toFixed(1)}%)`)
  if (v.uninsured_pct != null && v.uninsured_pct > a.uninsured_pct) gaps.push(`${v.uninsured_pct.toFixed(1)}% of adults 18–64 are uninsured (California: ${a.uninsured_pct.toFixed(1)}%)`)
  if (v.no_transport_pct != null && v.no_transport_pct > a.no_transport_pct) gaps.push(`${v.no_transport_pct.toFixed(1)}% lack reliable transportation (California: ${a.no_transport_pct.toFixed(1)}%)`)
  if (v.food_insecure_pct != null && v.food_insecure_pct > a.food_insecure_pct) gaps.push(`${v.food_insecure_pct.toFixed(1)}% report food insecurity (California: ${a.food_insecure_pct.toFixed(1)}%)`)
  if (v.limited_english_pct != null && v.limited_english_pct > a.limited_english_pct) gaps.push(`${v.limited_english_pct.toFixed(1)}% of households have limited English (California: ${a.limited_english_pct.toFixed(1)}%)`)
  if (gaps.length) parts.push(`Residents face significant barriers to care: ${gaps.join('; ')}.`)
  if (v.mammo_pct != null && v.mammo_pct < a.mammo_pct) parts.push(`Only ${v.mammo_pct.toFixed(1)}% of women 50–74 have had a recent mammogram, compared with ${a.mammo_pct.toFixed(1)}% statewide.`)
  const far: string[] = []
  const sm = state.values
  if (v.km_health_center != null && sm.km_health_center != null && v.km_health_center > sm.km_health_center) far.push(`a health center (~${v.km_health_center.toFixed(1)} km on average)`)
  if (v.km_family_planning != null && sm.km_family_planning != null && v.km_family_planning > sm.km_family_planning) far.push(`a family planning clinic (~${v.km_family_planning.toFixed(1)} km)`)
  if (v.km_birthing_hospital != null && sm.km_birthing_hospital != null && v.km_birthing_hospital > sm.km_birthing_hospital) far.push(`a hospital that delivers babies (~${v.km_birthing_hospital.toFixed(1)} km)`)
  if (far.length) parts.push(`Women here live farther than the state average from ${far.join(', ')}, measured in straight-line distance.`)
  parts.push('A new site offering well-woman exams, birth control, Pap and HPV screening, STI testing, and prenatal and postpartum care would address these gaps.')
  return parts.join(' ')
}

export function downloadFile(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export const csvRow = (cells: (string | number | null)[]) =>
  cells.map((c) => (c == null ? '' : /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(',')
