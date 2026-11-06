import { useEffect, useState } from 'react'
import { kmBetween, nearestOfType } from '../../lib/geo'
import { FACILITY_STYLE } from '../../lib/style'
import type { FacilityType, TractProps } from '../../lib/types'
import type { StepProps } from './types'

/** Women in each ZIP and their straight-line distance to the site (from the ZIP's women-weighted center). */
export function zipDistances(area: TractProps[], zips: string[], lat: number, lon: number) {
  return zips.map((z) => {
    const ts = area.filter((t) => t.zcta === z)
    const women = ts.reduce((s, t) => s + (t.women_total ?? 0), 0)
    const w = women || 1
    const clat = ts.reduce((s, t) => s + t.lat * (t.women_total ?? 0), 0) / w
    const clon = ts.reduce((s, t) => s + t.lon * (t.women_total ?? 0), 0) / w
    return { zip: z, women, km: women ? kmBetween(lat, lon, clat, clon) : null }
  }).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9))
}

export function withinShare(area: TractProps[], lat: number, lon: number, km: number) {
  const total = area.reduce((s, t) => s + (t.women_total ?? 0), 0)
  const near = area.filter((t) => kmBetween(lat, lon, t.lat, t.lon) <= km).reduce((s, t) => s + (t.women_total ?? 0), 0)
  return total ? (near / total) * 100 : 0
}

const ALTERNATIVES: FacilityType[] = ['health_center', 'family_planning', 'birthing_hospital', 'mammography']
const HOUR_IDEAS = ['Evenings Tue & Thu until 7pm', 'Saturday mornings', 'Walk-in hours daily', 'Mobile clinic days in outlying towns']

export default function AccessStep(p: StepProps) {
  const { plan, update, area, stats } = p
  useEffect(() => () => p.setMapMode('explore'), []) // eslint-disable-line react-hooks/exhaustive-deps
  const { lat, lon } = plan.site
  const rows = zipDistances(area, plan.zips, lat, lon)
  const moving = p.mapMode === 'site'
  const [saved, setSaved] = useState(false)
  // Snapshot the mini map (service area + site) as the report's coverage map.
  function saveMap() {
    const canvas = document.querySelector<HTMLCanvasElement>('.mini-map canvas.maplibregl-canvas')
    if (!canvas) return
    try {
      update({ coverageMap: canvas.toDataURL('image/jpeg', 0.85) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* canvas unreadable: leave the map off the report */ }
  }

  return (
    <div className="step">
      <p className="step-lede">
        Show the site is easy to reach and open when patients can come.
      </p>

      <h3>Where the site is</h3>
      <div className="step-actions">
        <button className={`btn small${moving ? ' on' : ''}`} onClick={() => p.setMapMode(moving ? 'explore' : 'site')} aria-pressed={moving}>
          {moving ? 'Click the map to place the site…' : 'Move the site pin'}
        </button>
      </div>
      <label className="field">
        <span>Street address (if known)</span>
        <input value={plan.site.address} placeholder="e.g., 21800 Colorado Ave, San Joaquin"
          onChange={(e) => update({ site: { ...plan.site, address: e.target.value } })} />
      </label>

      <div className="step-actions">
        <button className="btn small" onClick={saveMap}>{saved ? 'Saved to report ✓' : plan.coverageMap ? 'Update coverage map' : 'Save map to report as coverage map'}</button>
        <span className="hint">Title X requires a coverage map of sites vs. need.</span>
      </div>

      <h3>How close is it?</h3>
      <div className="stat-row">
        <div><b>{withinShare(area, lat, lon, 10).toFixed(0)}%</b><span>of the area's women within 10 km</span></div>
        <div><b>{withinShare(area, lat, lon, 20).toFixed(0)}%</b><span>within 20 km</span></div>
        <div><b>{stats.area.values.no_transport_pct?.toFixed(0) ?? '–'}%</b><span>lack reliable transportation</span></div>
      </div>
      <table className="metrics">
        <thead><tr><th scope="col">ZIP code</th><th scope="col">Women</th><th scope="col">To site</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.zip}><th scope="row">{r.zip}</th><td>{Math.round(r.women).toLocaleString()}</td><td>{r.km == null ? '–' : `~${r.km.toFixed(1)} km`}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Straight-line distance; real drive times are longer.</p>

      <h3>Existing care near the site</h3>
      <ul className="nearest">
        {ALTERNATIVES.map((type) => {
          const n = nearestOfType(p.facilities, type, lat, lon)
          return (
            <li key={type}>
              <span>
                <span className="near-type">{FACILITY_STYLE[type].label}</span>
                {n ? <span className="near-name">{n.facility.properties.name} · ~{n.km.toFixed(1)} km</span> : 'None found'}
              </span>
            </li>
          )
        })}
      </ul>

      <h3>Hours that fit patients</h3>
      <label className="field">
        <span>Planned hours</span>
        <textarea rows={2} value={plan.hours} placeholder="e.g., Mon–Fri 8–5, evenings Tue & Thu for working patients"
          onChange={(e) => update({ hours: e.target.value })} />
      </label>
      <label className="field">
        <span>Estimated clients per year</span>
        <input value={plan.clients ?? ''} placeholder={`e.g., ${Math.round(stats.area.lowIncomeWomen * 0.1).toLocaleString()} (10% of low-income women 15–44 here)`}
          onChange={(e) => update({ clients: e.target.value })} />
      </label>
      <div className="zip-chips">
        {HOUR_IDEAS.map((h) => (
          <button key={h} className="chip" onClick={() => update({ hours: plan.hours ? `${plan.hours}; ${h}` : h })}>+ {h}</button>
        ))}
      </div>
      <div className="step-actions">
        <button className="btn" onClick={() => p.print(['access'])}>Print access summary</button>
      </div>
    </div>
  )
}
