import type { FacilityType } from './types'

/**
 * Sequential purple ramp for the need-score shading, keyed on the tract's statewide rank (0-1)
 * so the colors spread evenly. Light = lower need, deep purple = higher need.
 */
export const SCORE_RAMP: [number, string][] = [
  [0.1, '#f1edfc'],
  [0.4, '#d5cbf7'],
  [0.65, '#a996ec'],
  [0.85, '#7559dc'],
  [0.97, '#4527a8'],
]
/** Kept for the dark basemap; the app currently renders light only. */
export const SCORE_RAMP_DARK = SCORE_RAMP

/** What each marker color means. Fill vs. hollow ring tells the two types within a color apart. */
export const ROLE_STYLE = {
  existing: {
    color: '#eb6834', title: 'Existing care',
    note: 'A new site nearby may compete with these, or partner with them.',
  },
  referral: {
    color: '#1baf7a', title: 'Where patients get referred',
    note: 'A health center refers patients here for births and mammograms.',
  },
  land: {
    color: '#2a78d6', darkColor: '#2a78d6', title: 'Public land & buildings for sale',
    note: 'Offered by cities, counties and districts under the Surplus Land Act.',
  },
} as const

/** Surplus Land Act parcels: filled = open for offers now, ring = offered since 2024 (ask the agency). */
export const LAND_STYLE = {
  open: { label: 'Open for offers now', hollow: false, radius: 7 },
  recent: { label: 'Offered 2024–26 (ask if still available)', hollow: true, radius: 5 },
} as const

/** Facility markers; `role` picks the color from ROLE_STYLE. */
export const FACILITY_STYLE: Record<FacilityType, {
  label: string; hollow: boolean; radius: number; role: 'existing' | 'referral'
}> = {
  health_center: { label: 'Community health centers', hollow: false, radius: 4, role: 'existing' },
  family_planning: { label: 'Family planning clinics (Family PACT)', hollow: true, radius: 4, role: 'existing' },
  birthing_hospital: { label: 'Hospitals that deliver babies', hollow: false, radius: 6, role: 'referral' },
  mammography: { label: 'Mammography sites', hollow: true, radius: 4, role: 'referral' },
  ld_closed: { label: 'Stopped delivering babies since 2021 (black ring)', hollow: true, radius: 6, role: 'referral' },
}
