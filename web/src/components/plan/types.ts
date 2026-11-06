import type { Feature, Point } from 'geojson'
import type { AreaStats, SitePlan } from '../../lib/plan'
import type { Facility, Hospital, LandProps, Meta, Site, TractProps } from '../../lib/types'

export type MapMode = 'explore' | 'zip' | 'site'

/** Everything a site plan step needs: the plan, its computed area, and the loaded data. */
export interface StepProps {
  plan: SitePlan
  update: (patch: Partial<SitePlan>) => void
  all: TractProps[]
  area: TractProps[]
  stats: { area: AreaStats; county: AreaStats; state: AreaStats }
  counties: string[]
  meta: Meta
  countyName: (fips: string) => string
  facilities: Facility[]
  land: Feature<Point, LandProps>[]
  hospitals: Hospital[]
  sites: Site[]
  mapMode: MapMode
  setMapMode: (m: MapMode) => void
  print: (sections: PrintSection[], programId?: import('../../lib/programs').ProgramId) => void
}

export type PrintSection = 'area' | 'need' | 'access' | 'space' | 'partners'

/** A print request: which sections, and which funder's version. */
export interface PrintRequest {
  sections: PrintSection[]
  programId?: import('../../lib/programs').ProgramId
}
