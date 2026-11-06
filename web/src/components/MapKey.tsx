import { useState } from 'react'
import type { FacilityType, LandProps, Meta } from '../lib/types'
import { FACILITY_STYLE, LAND_STYLE, ROLE_STYLE, SCORE_RAMP } from '../lib/style'

type LandStatus = LandProps['status']

interface Props {
  visible: Record<FacilityType, boolean>
  onToggle: (k: FacilityType) => void
  landVisible: Record<LandStatus, boolean>
  onToggleLand: (k: LandStatus) => void
  meta: Meta
  dark: boolean
}

function Swatch({ color, hollow }: { color: string; hollow: boolean }) {
  return <span className={`swatch${hollow ? ' hollow' : ''}`} style={{ ['--c' as string]: color }} aria-hidden="true" />
}

const GROUPS = [
  { role: 'existing', short: 'Existing care' },
  { role: 'referral', short: 'Referral care' },
  { role: 'land', short: 'Public land' },
] as const

/**
 * The map's only key, pinned bottom-left: the need-score gradient and what each dot color means.
 * Folded it's a compact key; opened it lists every layer with a checkbox to show or hide it.
 */
export default function MapKey({ visible, onToggle, landVisible, onToggleLand, meta }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`map-key${open ? ' open' : ''}`} role="group" aria-label="Map key and layers">
      <div className="map-key-title">Need score</div>
      <span className="ramp" style={{ background: `linear-gradient(to right, ${SCORE_RAMP.map(([, c]) => c).join(',')})` }} />
      <div className="ramp-labels"><span>Lower</span><span>Higher</span></div>

      {!open && (
        <div className="key-dots">
          {GROUPS.map((g) => <span key={g.role}><Swatch color={ROLE_STYLE[g.role].color} hollow={false} />{g.short}</span>)}
        </div>
      )}

      {open && (
        <div className="map-key-body">
          {(['existing', 'referral'] as const).map((role) => (
            <fieldset key={role}>
              <legend title={ROLE_STYLE[role].note}>{ROLE_STYLE[role].title}</legend>
              {(Object.keys(FACILITY_STYLE) as FacilityType[]).filter((k) => FACILITY_STYLE[k].role === role).map((k) => (
                <label key={k} className="toggle">
                  <input type="checkbox" checked={visible[k]} onChange={() => onToggle(k)} />
                  <Swatch color={k === 'ld_closed' ? '#1d1a2b' : ROLE_STYLE[role].color} hollow={FACILITY_STYLE[k].hollow} />
                  <span>{FACILITY_STYLE[k].label}</span>
                  <span className="count">{(meta.counts[k] ?? 0).toLocaleString()}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <fieldset>
            <legend title={ROLE_STYLE.land.note}>{ROLE_STYLE.land.title}</legend>
            {(Object.keys(LAND_STYLE) as LandStatus[]).map((k) => (
              <label key={k} className="toggle">
                <input type="checkbox" checked={landVisible[k]} onChange={() => onToggleLand(k)} />
                <Swatch color={ROLE_STYLE.land.color} hollow={LAND_STYLE[k].hollow} />
                <span>{LAND_STYLE[k].label}</span>
                <span className="count">{meta.land_counts[k].toLocaleString()}</span>
              </label>
            ))}
          </fieldset>
          <p className="key-note">Filled dot and ring = two kinds of place. Gray areas have too few residents to rank.</p>
        </div>
      )}
      <button className="key-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Hide layers' : 'Show or hide layers'}
      </button>
    </div>
  )
}
