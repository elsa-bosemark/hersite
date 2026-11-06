import { useEffect, useRef } from 'react'

const SOURCES: [string, string, string][] = [
  ['Women by age, poverty, low income, language', 'U.S. Census ACS 5-year 2019–2023 (tables B01001, B17001, C17002, C16002)', 'https://www.census.gov/programs-surveys/acs'],
  ['Uninsured, transportation, screening, food and housing insecurity, chronic disease', 'CDC PLACES, 2022–2023 model-based tract estimates', 'https://www.cdc.gov/places'],
  ['Community health centers', 'HRSA Health Center Service Delivery Sites', 'https://data.hrsa.gov/data/download'],
  ['Family planning clinics', 'CA DHCS Family PACT enrolled providers, 2026 Q1', 'https://data.chhs.ca.gov/dataset/medi-cal-fpact-enrolled-providers'],
  ['Labor & delivery, closures', 'CA HCAI Hospital Annual Utilization, 2021 vs 2025 (maternity discharges & beds)', 'https://data.chhs.ca.gov/dataset/hospital-annual-utilization-report'],
  ['Mammography sites', 'FDA MQSA certified facilities, geocoded with the Census geocoder', 'https://www.fda.gov/radiation-emitting-products/consumers-mammography/mammography-facilities'],
  ['Public land & buildings for sale', 'CA HCD Surplus Land Act notices (self-reported by local agencies, not verified by HCD)', 'https://data.ca.gov/dataset/surplus-land-act-notices-of-availability-received'],
  ['Tract boundaries', 'Census cartographic boundary files 2023', 'https://www.census.gov/geographies/mapping-files.html'],
]

export default function SourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={ref} onClose={onClose} className="sources">
      <div className="detail-head">
        <h2>Data sources & method</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p>All data is public and aggregated. HerSite uses no patient data and doesn't track visitors.</p>
      <ul>
        {SOURCES.map(([what, src, url]) => (
          <li key={what}><strong>{what}:</strong> <a href={url} target="_blank" rel="noreferrer">{src}</a></li>
        ))}
      </ul>
      <h3>How the score works</h3>
      <p>
        Each factor is turned into a percentile across about 9,000 California tracts (0 = least need, 1 = most).
        The need score is the weighted average of those percentiles, using the weights you set.
        Tracts with fewer than 300 women are shown in gray and not ranked.
      </p>
      <h3>Known limits</h3>
      <ul>
        <li>Distances are straight-line from each tract's center, not drive time.</li>
        <li>CDC PLACES values are modeled estimates, not direct counts.</li>
        <li>A closure means a hospital reported maternity care in 2021 but no maternity beds or discharges in 2025.
          Hospitals that didn't file in 2025 are treated as still open.</li>
        <li>Surplus Land Act parcels must be offered first to affordable housing, parks and schools.
          A health center can usually buy one only after that offer period ends, so check with the agency.
          A past notice doesn't mean the parcel is still available.</li>
        <li>Prices aren't shown yet. Turquoise Health or Medicare fee schedule data can be added as a price layer.</li>
      </ul>
    </dialog>
  )
}
