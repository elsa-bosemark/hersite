import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'

export interface TractProps {
  GEOID: string
  county_fips: string
  zcta: string | null
  pop_total: number | null
  limited_english_pct: number | null
  housing_insecure_pct: number | null
  diabetes_pct: number | null
  bphigh_pct: number | null
  depression_pct: number | null
  obesity_pct: number | null
  food_insecure_pct: number | null
  under100_pct: number | null
  under200_pct: number | null
  women_total: number | null
  women_15_44: number | null
  women_45_64: number | null
  poverty_pct: number | null
  uninsured_pct: number | null
  no_transport_pct: number | null
  mammo_pct: number | null
  checkup_pct: number | null
  km_health_center: number
  km_family_planning: number
  km_birthing_hospital: number
  km_mammography: number
  county_no_birthing: 0 | 1
  rankable: 0 | 1
  lat: number
  lon: number
  p_women: number | null
  p_poverty: number | null
  p_uninsured: number | null
  p_transport: number | null
  p_mammo_gap: number | null
  p_far_hc: number | null
  p_far_fp: number | null
  p_far_birth: number | null
  p_far_mammo: number | null
  score?: number
  score_rank?: number
}

export type FacilityType = 'health_center' | 'family_planning' | 'birthing_hospital' | 'ld_closed' | 'mammography'

export interface FacilityProps {
  type: FacilityType
  name: string
  address: string
  city: string
  detail: string
  /** Health centers only: the organization that runs the site, and the site's phone. */
  org?: string
  phone?: string
}

/** A general acute care hospital, for the letters-of-support list. */
export interface Hospital {
  name: string
  address: string
  city: string
  phone: string
  lat: number
  lon: number
  rural: boolean
  births: boolean
}

/** A public parcel offered under California's Surplus Land Act. */
export interface LandProps {
  status: 'open' | 'recent'
  agency: string
  address: string
  city: string
  acres: number | null
  zoning: string
  use: string
  vacant: boolean
  due: string
  link: string
}
export type Land = FeatureCollection<Point, LandProps>

export type Tract = Feature<Geometry, TractProps>
export type Facility = Feature<Point, FacilityProps>
export type Tracts = FeatureCollection<Geometry, TractProps>
export type Facilities = FeatureCollection<Point, FacilityProps>

export interface Meta {
  state_avg: Record<'mammo_pct' | 'uninsured_pct' | 'no_transport_pct' | 'poverty_pct' | 'checkup_pct'
    | 'limited_english_pct' | 'housing_insecure_pct' | 'diabetes_pct' | 'bphigh_pct' | 'depression_pct' | 'obesity_pct'
    | 'food_insecure_pct' | 'under100_pct' | 'under200_pct', number>
  state_median_km: Record<string, number>
  counties: Record<string, string>
  counts: Record<FacilityType, number>
  tracts: number
  rankable_tracts: number
  land_counts: Record<LandProps['status'], number>
}

export interface Site {
  id: string
  name: string
  lat: number
  lon: number
}
