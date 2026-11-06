import { useEffect } from 'react'
import { csvRow, downloadFile, zipsNear } from '../../lib/plan'
import type { StepProps } from './types'

export default function ServiceAreaStep(p: StepProps) {
  const { plan, update, all, area, stats, counties } = p
  // Clicking the map adds or removes ZIP codes while this step is open.
  useEffect(() => {
    p.setMapMode('zip')
    return () => p.setMapMode('explore')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const nearby = zipsNear(all, plan.site.lat, plan.site.lon, plan.radiusKm * 1.6).filter((z) => !plan.zips.includes(z))
  const toggle = (z: string) => update({ zips: plan.zips.includes(z) ? plan.zips.filter((x) => x !== z) : [...plan.zips, z].sort() })

  function downloadZips() {
    const rows = plan.zips.map((z) => {
      const ts = area.filter((t) => t.zcta === z)
      const women = ts.reduce((s, t) => s + (t.women_total ?? 0), 0)
      const pop = ts.reduce((s, t) => s + (t.pop_total ?? 0), 0)
      return csvRow([z, Math.round(pop), Math.round(women), [...new Set(ts.map((t) => p.countyName(t.county_fips)))].join('; ')])
    })
    downloadFile(`${plan.name} - service area ZIP codes.csv`, [csvRow(['ZIP code', 'Population', 'Women', 'County']), ...rows].join('\n'))
  }

  return (
    <div className="step">
      <p className="step-lede">
        Pick the ZIP codes where the women you'll serve live. These go on HRSA Form 5B.
      </p>

      <div className="stat-row">
        <div><b>{plan.zips.length}</b><span>ZIP codes</span></div>
        <div><b>{Math.round(stats.area.women).toLocaleString()}</b><span>women</span></div>
        <div><b>{Math.round(stats.area.pop).toLocaleString()}</b><span>people</span></div>
      </div>
      {counties.length > 1 && (
        <p className="flag">Crosses {counties.join(' and ')} counties. HRSA asks that boundaries follow county and city lines where practical.</p>
      )}

      <label className="field">
        <span>Start from ZIP codes within <b>{plan.radiusKm} km</b> of the site</span>
        <input type="range" min={5} max={50} step={5} value={plan.radiusKm}
          onChange={(e) => update({ radiusKm: Number(e.target.value) })} />
      </label>
      <button className="btn small" onClick={() => update({ zips: zipsNear(all, plan.site.lat, plan.site.lon, plan.radiusKm) })}>
        Rebuild ZIP list from this distance
      </button>

      <h3>Selected ZIP codes</h3>
      <div className="zip-chips">
        {plan.zips.map((z) => (
          <button key={z} className="chip on" onClick={() => toggle(z)} aria-label={`Remove ZIP ${z}`}>{z} ×</button>
        ))}
        {!plan.zips.length && <span className="hint">No ZIP codes yet.</span>}
      </div>
      {nearby.length > 0 && (
        <>
          <h3>Nearby ZIP codes to consider</h3>
          <div className="zip-chips">
            {nearby.slice(0, 16).map((z) => <button key={z} className="chip" onClick={() => toggle(z)}>+ {z}</button>)}
          </div>
        </>
      )}

      <details className="fold inline">
        <summary><span>HRSA's rule for service areas</span></summary>
        <p className="hint">
          For an existing health center, the ZIPs should cover where at least 75% of current patients live (from your UDS report).
          For a new site, use where the women you plan to serve live. Review it every year.
        </p>
      </details>
      <div className="step-actions">
        <button className="btn" onClick={downloadZips} disabled={!plan.zips.length}>Download ZIP list (CSV)</button>
        <button className="btn ghost" onClick={() => p.print(['area'])} disabled={!plan.zips.length}>Print</button>
      </div>
    </div>
  )
}
