import type { Feature, Point } from 'geojson'
import type { Facility, FacilityType, LandProps, Meta, Site, TractProps } from '../lib/types'
import { fmtInt, reasons, recommendation } from '../lib/score'
import type { Weights } from '../lib/score'
import { kmBetween, nearestOfType } from '../lib/geo'
import { FACILITY_STYLE, ROLE_STYLE } from '../lib/style'

interface Props {
  t: TractProps
  rank: number | null
  weights: Weights
  meta: Meta
  facilities: Facility[]
  land: Feature<Point, LandProps>[]
  sites: Site[]
  countyName: (fips: string) => string
  town: string
  onClose: () => void
  onStartPlan: () => void
}

const NEAREST: FacilityType[] = ['health_center', 'family_planning', 'birthing_hospital', 'mammography']
const LAND_KM = 25
const LISTING_SEARCHES: [string, string][] = [
  ['Medical offices for lease', 'medical office space for lease'],
  ['Buildings for sale', 'commercial building for sale'],
]
const pct = (v: number | null) => (v == null ? '–' : `${v.toFixed(0)}%`)
const km = (v: number) => `${v < 10 ? v.toFixed(1) : v.toFixed(0)} km`

export default function TractDetail({ t, rank, weights, meta, facilities, land, sites, countyName, town, onClose, onStartPlan }: Props) {
  const a = meta.state_avg
  // The women count already has its own tile.
  const why = reasons(t, weights, meta).filter((r) => !r.endsWith('women live here'))
  const nearbyLand = land
    .map((f) => ({ l: f.properties, km: kmBetween(t.lat, t.lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) }))
    .filter((x) => x.km <= LAND_KM)
    .sort((x, y) => (x.l.status === y.l.status ? x.km - y.km : x.l.status === 'open' ? -1 : 1))
    .slice(0, 6)
  const nearbySites = sites
    .map((s) => ({ s, km: kmBetween(t.lat, t.lon, s.lat, s.lon) }))
    .filter((x) => x.km <= 15)
    .sort((x, y) => x.km - y.km)
  const nearest = NEAREST.map((type) => ({ type, n: nearestOfType(facilities, type, t.lat, t.lon) }))
  const hc = nearest[0].n

  // Key numbers as tiles; the full table is one click away.
  const tiles: [string, string, string][] = [
    [fmtInt(t.women_total), 'women live here', ''],
    [pct(t.uninsured_pct), 'adults uninsured', `CA ${pct(a.uninsured_pct)}`],
    [pct(t.mammo_pct), 'mammogram rate', `CA ${pct(a.mammo_pct)}`],
  ]
  const rows: [string, string, string][] = [
    ['Women 15–44', fmtInt(t.women_15_44), ''],
    ['Below poverty', pct(t.poverty_pct), pct(a.poverty_pct)],
    ['Adults uninsured', pct(t.uninsured_pct), pct(a.uninsured_pct)],
    ['No reliable transportation', pct(t.no_transport_pct), pct(a.no_transport_pct)],
    ['Limited-English households', pct(t.limited_english_pct), pct(a.limited_english_pct)],
    ['Mammogram use, women 50–74', pct(t.mammo_pct), pct(a.mammo_pct)],
    ['Routine checkup in past year', pct(t.checkup_pct), pct(a.checkup_pct)],
  ]

  return (
    <section className="panel detail" aria-live="polite">
      <div className="detail-head">
        <div>
          <p className="eyebrow">{rank ? `#${rank} place · ` : ''}{countyName(t.county_fips)} County</p>
          <h2>Near {town}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close details">×</button>
      </div>

      {t.score == null ? (
        <p className="muted">Too few residents to rank this area.</p>
      ) : (
        <div className="score-card">
          <div className="score-big">{(t.score * 100).toFixed(0)}<span>/100</span></div>
          <div>
            <div className="score-label">Need score</div>
            <ul className="why-list">{why.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        </div>
      )}

      <div className="tiles">
        {tiles.map(([v, label, cmp]) => (
          <div key={label} className="tile"><b>{v}</b><span>{label}</span>{cmp && <em>{cmp}</em>}</div>
        ))}
      </div>

      <button className="btn primary block" onClick={onStartPlan}>Start a site plan here</button>
      <p className="cta-note">Builds the documents for an HRSA application, step by step.</p>

      <div className="fits">
        <h3>What fits here</h3>
        <ul className="recs">{recommendation(t).map((r) => <li key={r}>{r}</li>)}</ul>
      </div>

      <details className="fold">
        <summary><span>Who lives here</span><span className="peek">{pct(t.poverty_pct)} below poverty</span></summary>
        <table className="metrics">
          <thead><tr><th scope="col">Measure</th><th scope="col">Here</th><th scope="col">CA</th></tr></thead>
          <tbody>{rows.map(([k, v, s]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td><td>{s}</td></tr>)}</tbody>
        </table>
      </details>

      <details className="fold">
        <summary><span>Nearest care</span><span className="peek">{hc ? `Health center ${km(hc.km)}` : ''}</span></summary>
        <ul className="nearest">
          {nearest.map(({ type, n }) => {
            const s = FACILITY_STYLE[type]
            return (
              <li key={type}>
                <span className={`swatch${s.hollow ? ' hollow' : ''}`} style={{ ['--c' as string]: ROLE_STYLE[s.role].color }} aria-hidden="true" />
                <span>
                  <span className="near-type">{s.label}</span>
                  {n ? <span className="near-name">{n.facility.properties.name} · {km(n.km)}</span> : <span>None found</span>}
                </span>
              </li>
            )
          })}
        </ul>
        {t.county_no_birthing === 1 && <p className="flag">No hospital in this county delivers babies.</p>}
        <p className="hint">Straight-line distance from the area's center.</p>
      </details>

      <details className="fold">
        <summary>
          <span>Space to buy or lease</span>
          <span className="peek">{nearbyLand.length ? `${nearbyLand.length} public parcels nearby` : 'Search listings'}</span>
        </summary>
        {nearbyLand.length > 0 && (
          <ul className="land-list">
            {nearbyLand.map(({ l, km: d }, i) => (
              <li key={i}>
                <span className={`swatch${l.status === 'recent' ? ' hollow' : ''}`} style={{ ['--c' as string]: 'var(--land)' }} aria-hidden="true" />
                <span>
                  <span className="near-name">{[l.address, l.city].filter(Boolean).join(', ') || 'Address not listed'} · {km(d)}</span>
                  <span className="near-type">
                    {l.status === 'open' ? `Open for offers until ${l.due}` : 'Offered 2024–26, ask if available'}
                    {l.acres != null ? ` · ${l.acres} acres` : ''}
                    {l.link && <> · <a href={l.link} target="_blank" rel="noreferrer">Notice</a></>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="listing-links">
          {LISTING_SEARCHES.map(([label, q]) => (
            <a key={label} className="chip" target="_blank" rel="noreferrer"
              href={`https://www.google.com/search?q=${encodeURIComponent(`${q} ${town}, CA`)}`}>{label} near {town} ↗</a>
          ))}
        </div>
        {nearbySites.length > 0 && (
          <ul className="sites">{nearbySites.map(({ s, km: d }) => <li key={s.id}>{s.name} · {km(d)}</li>)}</ul>
        )}
      </details>
    </section>
  )
}
