import { useMemo, useRef, useState } from 'react'
import { DEFAULT_PRESET, PRESETS } from '../lib/score'
import { searchPlaces } from '../lib/search'
import type { Place } from '../lib/search'
import type { SitePlan } from '../lib/plan'

interface Props {
  places: Place[]
  plans: SitePlan[]
  onPlan: (place: Place, focus: string) => void
  onOpenPlan: (id: string) => void
}

const EXAMPLES = ['Kerman', '93608', 'Plumas County']

/** The landing search: a health center usually knows its area, so planning starts from a place. */
export default function Hero({ places, plans, onPlan, onOpenPlan }: Props) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Place | null>(null)
  const [focus, setFocus] = useState(DEFAULT_PRESET)
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => (picked ? [] : searchPlaces(places, q)), [places, q, picked])

  function choose(p: Place) {
    setPicked(p)
    setQ(p.kind === 'ZIP code' ? `${p.label} · ${p.sub}` : p.label)
    setOpen(false)
    setError('')
  }

  function submit() {
    const p = picked ?? searchPlaces(places, q, 1)[0]
    if (!p) {
      setError(q.trim() ? `No California town, ZIP code or county matches “${q}”.` : 'Type a town, ZIP code or county.')
      input.current?.focus()
      return
    }
    onPlan(p, focus)
  }

  return (
    <section className="hero" id="plan">
      <div className="hero-bg" aria-hidden="true"><span /><span /><span /></div>
      <div className="hero-card">
        <h1>Plan where to open <span>women's care</span></h1>
        <p className="hero-sub">Fill it in once. Get evidence for Title X, HRSA's Health Center Program and CalRHT.</p>

        <form className="search-bar" role="search" onSubmit={(e) => { e.preventDefault(); submit() }}>
          <div className="search-field grow">
            <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            <label>
              <span>Where will you serve?</span>
              <input ref={input} value={q} placeholder="Town, ZIP code or county" autoComplete="off"
                role="combobox" aria-expanded={open && results.length > 0} aria-controls="place-list" aria-autocomplete="list"
                onChange={(e) => { setQ(e.target.value); setPicked(null); setOpen(true); setHi(0); setError('') }}
                onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
                onKeyDown={(e) => {
                  if (!results.length) return
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
                  if (e.key === 'Enter' && open) { e.preventDefault(); choose(results[hi]) }
                }} />
            </label>
            {open && results.length > 0 && (
              <ul className="suggest" id="place-list" role="listbox">
                {results.map((p, i) => (
                  <li key={`${p.kind}-${p.label}`} role="option" aria-selected={i === hi}
                    className={i === hi ? 'hi' : ''} onMouseDown={(e) => { e.preventDefault(); choose(p) }} onMouseEnter={() => setHi(i)}>
                    <span>{p.label}</span><span className="muted">{p.kind} · {p.sub}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="search-field">
            <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" /><path d="M12 10.5v4M10 12.5h4" /></svg>
            <label>
              <span>Care you'll offer</span>
              <select value={focus} onChange={(e) => setFocus(e.target.value)}>
                {Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
          </div>
          <button className="btn primary big" type="submit">Plan a site →</button>
        </form>
        {error && <p className="search-error" role="alert">{error}</p>}

        <p className="hero-try">
          Try{' '}
          {EXAMPLES.map((ex) => (
            <button key={ex} className="link" type="button" onClick={() => { setQ(ex); setPicked(null); setOpen(true); input.current?.focus() }}>{ex}</button>
          ))}
        </p>
        {plans.length > 0 && (
          <div className="hero-plans">
            <span className="muted">Continue a plan:</span>
            {plans.slice(-3).reverse().map((p) => <button key={p.id} className="chip" onClick={() => onOpenPlan(p.id)}>{p.name}</button>)}
          </div>
        )}
      </div>
    </section>
  )
}
