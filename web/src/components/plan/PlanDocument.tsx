import type { ReactNode } from 'react'
import { draftNarrative } from '../../lib/plan'
import { programOf } from '../../lib/programs'
import type { ProgramId } from '../../lib/programs'
import { NeedTable } from './NeedStep'
import { withinShare, zipDistances } from './AccessStep'
import { spaceOptions } from './SpaceStep'
import { buildPartners } from './PartnersStep'
import { checklist } from './PacketStep'
import type { PrintSection, StepProps } from './types'

const SECTIONS: { key: PrintSection; step: number; title: string }[] = [
  { key: 'area', step: 0, title: 'Service area' },
  { key: 'need', step: 1, title: 'Assessment of unmet need' },
  { key: 'access', step: 2, title: 'Site accessibility' },
  { key: 'space', step: 3, title: 'Proposed site & space' },
  { key: 'partners', step: 4, title: 'Collaboration log' },
]

interface Props extends StepProps {
  sections: PrintSection[]
  /** Live preview mode: the current step's section is highlighted and every section links back to its step. */
  current?: number
  onJump?: (step: number) => void
  /** Which funder's version to show; defaults to the plan's own program. */
  programId?: ProgramId
}

/**
 * The application document. The same component is the live preview beside the wizard and the printed report,
 * so what Maria sees filling in is exactly what she downloads.
 */
export default function PlanDocument(p: Props) {
  const { plan, stats, counties } = p
  const live = p.onJump != null
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const countyLabel = `${p.countyName(p.all.find((t) => t.GEOID === plan.tract)?.county_fips ?? '')} County`
  const status = checklist(p)
  const partners = buildPartners(p)
  const shortlist = spaceOptions(p).filter((o) => plan.spaces[o.id] || plan.chosenSpace === o.id)
  const program = programOf(p.programId ?? plan.program)
  const partnersTitle = program.partners.letter === 'commitment' ? 'Referral partners & letters of commitment' : 'Collaboration log'

  function Head({ s }: { s: typeof SECTIONS[number] }) {
    const done = status[s.step]?.done
    const editing = live && p.current === s.step
    const title = s.key === 'partners' ? partnersTitle : s.title
    return (
      <div className="doc-head">
        <h2>{s.step + 1}. {title}</h2>
        {live && (
          <span className="doc-meta no-print">
            {editing ? (
              <>
                <span className="pill editing">✎ Editing</span>
                <button className="btn primary small" onClick={() => p.onJump!(s.step + 1)}>
                  {s.step < 4 ? 'Done → next section' : 'Done → review report'}
                </button>
              </>
            ) : (
              <>
                <span className={`pill${done ? ' done' : ''}`}>{done ? 'Complete' : 'Needs input'}</span>
                <button className="link" onClick={() => p.onJump!(s.step)}>Edit</button>
              </>
            )}
          </span>
        )}
      </div>
    )
  }
  const Auto = () => (live ? <span className="auto no-print">Auto-filled from public data</span> : null)
  const Todo = ({ children }: { children: ReactNode }) => <span className="todo">{children}</span>

  return (
    <article className="print-page">
      <header>
        <p className="eyebrow">{program.name} · application evidence · {today}</p>
        <h1>{plan.name}</h1>
        <p>{plan.org || <Todo>[Your organization]</Todo>} · {counties.join(', ')} {counties.length === 1 ? 'County' : 'Counties'}, California</p>
      </header>

      {SECTIONS.filter((s) => p.sections.includes(s.key)).map((s) => (
        <section key={s.key} className={live && p.current === s.step ? 'current' : ''} id={`doc-${s.key}`}>
          <Head s={s} />

          {s.key === 'area' && (
            <>
              <Auto />
              <p>{plan.zips.length} ZIP codes · {Math.round(stats.area.pop).toLocaleString()} people · {Math.round(stats.area.women).toLocaleString()} women</p>
              <p className="zip-line">{plan.zips.join(', ') || <Todo>No ZIP codes selected</Todo>}</p>
              <h3 className="doc-sub">Coverage map</h3>
              {plan.coverageMap
                ? <img className="coverage-map" src={plan.coverageMap} alt="Coverage map: the service area shaded by need, with the proposed site" />
                : <p><Todo>Add a coverage map from the Site &amp; access step</Todo></p>}
              <p className="note">Shading shows the need score; ★ marks the proposed site.</p>
            </>
          )}

          {s.key === 'need' && (
            <>
              <Auto />
              <p>{plan.narrative || draftNarrative(stats.area, stats.state, counties, plan.zips)}</p>
              <NeedTable stats={stats} plan={plan} countyLabel={countyLabel} editable={false} />
              <p className="note">Percentages are population-weighted across the service area's census tracts. CDC PLACES values are model-based estimates. Distances are straight-line.</p>
            </>
          )}

          {s.key === 'access' && (
            <>
              <p><b>Location:</b> {plan.site.address || <Todo>Add the street address</Todo>}</p>
              <p><b>Planned hours:</b> {plan.hours || <Todo>Add planned hours</Todo>}</p>
              <p><b>Estimated clients per year:</b> {plan.clients || <Todo>Add an estimate</Todo>}
                {' '}(about {Math.round(stats.area.lowIncomeWomen).toLocaleString()} low-income women 15–44 live in the service area)</p>
              <p>
                {withinShare(p.area, plan.site.lat, plan.site.lon, 10).toFixed(0)}% of the service area's women live within 10 km of the site and{' '}
                {withinShare(p.area, plan.site.lat, plan.site.lon, 20).toFixed(0)}% within 20 km (straight-line).{' '}
                {stats.area.values.no_transport_pct != null && `${stats.area.values.no_transport_pct.toFixed(1)}% of adults lack reliable transportation.`}
              </p>
              <table className="metrics">
                <thead><tr><th>ZIP code</th><th>Women</th><th>Distance to site</th></tr></thead>
                <tbody>{zipDistances(p.area, plan.zips, plan.site.lat, plan.site.lon).map((r) => (
                  <tr key={r.zip}><td>{r.zip}</td><td>{Math.round(r.women).toLocaleString()}</td><td>{r.km == null ? '–' : `~${r.km.toFixed(1)} km`}</td></tr>
                ))}</tbody>
              </table>
            </>
          )}

          {s.key === 'space' && (shortlist.length ? (
            <table className="metrics">
              <thead><tr><th>Space</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>{shortlist.map((o) => (
                <tr key={o.id}>
                  <td>{o.title}{plan.chosenSpace === o.id && <b> (chosen)</b>}</td>
                  <td>{plan.spaces[o.id]?.status ?? 'Not started'}</td><td>{plan.spaces[o.id]?.note ?? ''}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p><Todo>No spaces tracked yet</Todo></p>)}

          {s.key === 'partners' && (
            <>
              <p>{program.partners.letter === 'commitment'
                ? 'Referral entities that will provide services not paid for by Title X, and the status of their letters of commitment.'
                : 'Efforts to coordinate with providers serving the service area, and the status of their letters.'}</p>
              <table className="metrics">
                <thead><tr><th>Partner</th><th>Type</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>{partners.map((x) => (
                  <tr key={x.id}>
                    <td>{x.name}</td><td>{x.kind}</td><td>{plan.partners[x.id]?.status ?? 'Not asked'}</td><td>{plan.partners[x.id]?.date ?? ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </>
          )}
        </section>
      ))}
      <footer className="note">Built with HerSite from public data: Census ACS, CDC PLACES, HRSA, CA DHCS, CA HCAI, FDA, CA HCD. No patient data.</footer>
    </article>
  )
}
