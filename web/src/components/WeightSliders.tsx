import { DEFAULT_PRESET, FACTORS, PRESETS, PRESET_INFO } from '../lib/score'
import type { FactorKey, Weights } from '../lib/score'

interface Props {
  weights: Weights
  onChange: (w: Weights) => void
}

const LEVELS = ['Off', 'Low', 'Med', 'High']

export default function WeightSliders({ weights, onChange }: Props) {
  const active = Object.entries(PRESETS).find(([, p]) => FACTORS.every((f) => p[f.key] === weights[f.key]))?.[0]
  const set = (k: FactorKey, v: number) => onChange({ ...weights, [k]: v })

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Care you'll offer</h2>
        <span className="muted small">Changes the shading &amp; Top 10</span>
      </div>
      <div className="segmented" role="group" aria-label="Care you'll offer">
        {Object.entries(PRESETS).map(([name, p]) => (
          <button key={name} className={active === name ? 'on' : ''} aria-pressed={active === name} onClick={() => onChange(p)}>
            {name}
          </button>
        ))}
      </div>
      <p className="preset-info">{active ? PRESET_INFO[active] : 'Custom mix of factors.'}</p>
      <details className="fold inline">
        <summary><span>Fine-tune factors</span></summary>
        {(['Need', 'Distance to care'] as const).map((g) => (
          <fieldset key={g}>
            <legend>{g === 'Need' ? 'Who lives here' : 'How far care is'}</legend>
            {FACTORS.filter((f) => f.group === g).map((f) => (
              <label key={f.key} className="slider" title={f.hint}>
                <span className="slider-label">{f.label}</span>
                <input type="range" min={0} max={3} step={1} value={weights[f.key]} aria-valuetext={LEVELS[weights[f.key]]}
                  onChange={(e) => set(f.key, Number(e.target.value))} />
                <span className="level">{LEVELS[weights[f.key]]}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <button className="link reset" onClick={() => onChange(PRESETS[DEFAULT_PRESET])}>Reset</button>
      </details>
    </section>
  )
}
