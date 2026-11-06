import { kmBetween } from '../../lib/geo'
import { SPACE_STATUSES } from '../../lib/plan'
import type { SpaceStatus } from '../../lib/plan'
import type { StepProps } from './types'

export interface SpaceOption {
  id: string
  title: string
  detail: string
  lat: number
  lon: number
  km: number
  link?: string
}

export function spaceOptions(p: Pick<StepProps, 'plan' | 'land' | 'sites'>): SpaceOption[] {
  const { lat, lon } = p.plan.site
  const land = p.land.map((f, i) => {
    const l = f.properties
    const [flon, flat] = f.geometry.coordinates
    const size = l.acres != null ? `${l.acres} acres · ` : ''
    return {
      id: `land-${i}-${flat.toFixed(4)}-${flon.toFixed(4)}`,
      title: [l.address, l.city].filter(Boolean).join(', ') || `Parcel offered by ${l.agency}`,
      detail: `${l.status === 'open' ? `Public land, open for offers until ${l.due}` : 'Public land offered 2024–26; ask if still available'} · ${size}${l.vacant ? 'Vacant land' : l.use} · ${l.agency}`,
      lat: flat, lon: flon, km: kmBetween(lat, lon, flat, flon), link: l.link || undefined,
    }
  }).filter((o) => o.km <= 25)
  const pins = p.sites.map((s) => ({
    id: `pin-${s.id}`, title: s.name, detail: 'Your candidate space', lat: s.lat, lon: s.lon, km: kmBetween(lat, lon, s.lat, s.lon),
  }))
  return [...pins, ...land].sort((a, b) => a.km - b.km).slice(0, 12)
}

const SEARCHES: [string, string][] = [
  ['Medical office for lease', 'medical office space for lease'],
  ['Commercial space for sale', 'commercial building for sale'],
]

export default function SpaceStep(p: StepProps) {
  const { plan, update } = p
  const options = spaceOptions(p)
  const town = p.facilities
    .map((f) => ({ city: f.properties.city, km: kmBetween(plan.site.lat, plan.site.lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) }))
    .reduce((a, b) => (b.km < a.km ? b : a), { city: '', km: Infinity }).city

  const setStatus = (id: string, status: SpaceStatus) =>
    update({ spaces: { ...plan.spaces, [id]: { note: plan.spaces[id]?.note ?? '', status } } })
  const setNote = (id: string, note: string) =>
    update({ spaces: { ...plan.spaces, [id]: { status: plan.spaces[id]?.status ?? 'Not started', note } } })
  const choose = (o: SpaceOption) => update({
    chosenSpace: o.id,
    site: { lat: o.lat, lon: o.lon, address: o.title },
  })

  return (
    <div className="step">
      <p className="step-lede">
        Track spaces you're considering. The one you choose becomes your site address.
      </p>
      {options.length ? (
        <ul className="space-list">
          {options.map((o) => {
            const s = plan.spaces[o.id]
            const chosen = plan.chosenSpace === o.id
            return (
              <li key={o.id} className={chosen ? 'chosen' : ''}>
                <div className="space-head">
                  <span>
                    <span className="near-name">{o.title} · ~{o.km.toFixed(1)} km</span>
                    <span className="near-type">{o.detail}{o.link && <> · <a href={o.link} target="_blank" rel="noreferrer">Notice</a></>}</span>
                  </span>
                  <button className={`btn small${chosen ? ' on' : ''}`} onClick={() => choose(o)} aria-pressed={chosen}>
                    {chosen ? 'Chosen site' : 'Choose'}
                  </button>
                </div>
                <div className="space-controls">
                  <select value={s?.status ?? 'Not started'} onChange={(e) => setStatus(o.id, e.target.value as SpaceStatus)} aria-label="Status">
                    {SPACE_STATUSES.map((st) => <option key={st}>{st}</option>)}
                  </select>
                  <input placeholder="Notes (rent, size, contact…)" value={s?.note ?? ''} onChange={(e) => setNote(o.id, e.target.value)} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="hint">No public land offered within 25 km of the site. Search listings below, or add your own candidate spaces.</p>
      )}
      <h3>Search commercial listings near {town || 'the site'}</h3>
      <div className="listing-links">
        {SEARCHES.map(([label, q]) => (
          <a key={label} className="chip" target="_blank" rel="noreferrer"
            href={`https://www.google.com/search?q=${encodeURIComponent(`${q} ${town}, CA`)}`}>{label} ↗</a>
        ))}
      </div>
      <p className="hint">Found one? Use “+ Add candidate space” at the top to pin it on the map; it then shows up here.</p>
      <div className="step-actions">
        <button className="btn" onClick={() => p.print(['space'])}>Print space shortlist</button>
      </div>
    </div>
  )
}
