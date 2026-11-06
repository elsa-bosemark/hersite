import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { STEPS } from '../../lib/plan'
import { PROGRAMS, PROGRAM_ORDER, programOf } from '../../lib/programs'
import type { ProgramId } from '../../lib/programs'
import { downloadAllVersions } from '../../lib/exportVersions'
import ServiceAreaStep from './ServiceAreaStep'
import NeedStep from './NeedStep'
import AccessStep from './AccessStep'
import SpaceStep from './SpaceStep'
import PartnersStep from './PartnersStep'
import PacketStep, { checklist, planProgress } from './PacketStep'
import PlanDocument from './PlanDocument'
import type { StepProps } from './types'

interface Props extends StepProps {
  onExit: () => void
  onDelete: () => void
  /** The compact map for the current step, and a one-line caption saying what it shows. */
  map: ReactNode
  mapCaption: string
}

const SHORT = ['Area', 'Need', 'Access', 'Space', 'Partners', 'Report']

/** Site plan workspace: a step-by-step wizard on the left, the application filling in live on the right. */
export default function SitePlanPanel(p: Props) {
  const { plan, update } = p
  const goTo = (step: number) => update({ step })
  const items = checklist(p)
  const done = planProgress(items)
  const doneSteps = new Set(items.filter((i) => i.done).map((i) => i.step))
  const Step = [ServiceAreaStep, NeedStep, AccessStep, SpaceStep, PartnersStep][plan.step]
  // One plan feeds every funder; the tab picks which version the preview shows.
  const program = programOf(plan.program)
  const [busy, setBusy] = useState<string | null>(null)
  const preview = (id: ProgramId) => PROGRAMS[id].available && update({ program: id })
  async function downloadAll() {
    try {
      await downloadAllVersions(p, setBusy)
    } finally {
      setBusy(null)
    }
  }
  const docRef = useRef<HTMLDivElement>(null)
  const wizardRef = useRef<HTMLDivElement>(null)

  // Keep the matching part of the application in view as the step changes.
  useEffect(() => {
    const key = ['area', 'need', 'access', 'space', 'partners'][plan.step]
    const el = key && docRef.current?.querySelector(`#doc-${key}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Each step starts at its top; the scroll area is the wizard body, not the whole column.
    wizardRef.current?.querySelector('.wizard-body')?.scrollTo({ top: 0 })
  }, [plan.step])

  return (
    <div className="workspace-grid">
      <section className="wizard" ref={wizardRef} aria-label="Site plan steps">
        <div className="wizard-top">
          <div className="plan-head">
            <button className="link back" onClick={p.onExit}>← All of California</button>
            <span className="muted small">{done} of 5 done · saved in this browser</span>
          </div>
          <input className="plan-name" value={plan.name} onChange={(e) => update({ name: e.target.value })} aria-label="Plan name" />
          <p className="program-note">Built for HRSA's Health Center Program. Title X and CalRHT versions are coming soon.</p>
          <ol className="steps-bar">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button className={`${plan.step === i ? 'on' : ''}${doneSteps.has(i) ? ' done' : ''}`} onClick={() => goTo(i)}
                  aria-current={plan.step === i ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s.title}`}>
                  <span className="step-num">{doneSteps.has(i) && plan.step !== i ? '✓' : i + 1}</span>
                  <span className="step-title">{SHORT[i]}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="wizard-body">
          <div className="step-head">
            <p className="eyebrow">Step {plan.step + 1} of {STEPS.length}</p>
            <h2>{STEPS[plan.step].title}</h2>
            {plan.step < 5 && (
              <p className="used-in">HRSA asks for this in: {PROGRAMS.hrsa.refs[plan.step]}</p>
            )}
          </div>
          {plan.step < 5 && (
            <figure className="mini-map">
              <div className="mini-map-frame">{p.map}</div>
              <figcaption>{p.mapCaption}</figcaption>
            </figure>
          )}
          {Step ? <Step key={plan.step} {...p} /> : <PacketStep {...p} goTo={goTo} />}
        </div>

        <div className="wizard-nav">
          <button className="btn ghost" disabled={plan.step === 0} onClick={() => goTo(plan.step - 1)}>← Back</button>
          {plan.step < STEPS.length - 1 ? (
            <button className="btn primary" onClick={() => goTo(plan.step + 1)}>Next: {STEPS[plan.step + 1].title} →</button>
          ) : (
            <button className="btn primary" onClick={downloadAll} disabled={!!busy}>{busy ?? 'Download HRSA PDF'}</button>
          )}
        </div>
      </section>

      <section className="doc-pane" aria-label="Application preview">
        <div className="doc-bar">
          <div className="version-tabs" role="tablist" aria-label="Application version">
            {PROGRAM_ORDER.map((id) => {
              const pr = PROGRAMS[id]
              return (
                <button key={id} role="tab" aria-selected={program.id === id} aria-disabled={!pr.available}
                  disabled={!pr.available} title={pr.available ? undefined : `${pr.name}: coming soon`}
                  className={`${program.id === id ? 'on' : ''}${pr.available ? '' : ' soon'}`} onClick={() => preview(id)}>
                  {pr.short}{!pr.available && <span className="soon-tag">Soon</span>}
                </button>
              )
            })}
          </div>
          <div className="doc-actions">
            <button className="btn small" onClick={() => p.print(['area', 'need', 'access', 'space', 'partners'], program.id)}>Preview</button>
            <button className="btn small primary" onClick={downloadAll} disabled={!!busy}>{busy ?? 'Download PDF'}</button>
            <button className="link danger" onClick={() => { if (window.confirm(`Delete “${plan.name}”? This can't be undone.`)) p.onDelete() }}>Delete</button>
          </div>
        </div>
        <div className="version-head">
          <h2>{program.name}</h2>
          <p className="muted">Your application evidence, filling in as you go.</p>
          <details className="learn">
            <summary>Learn more about {program.short} and the application</summary>
            <p>{program.learn.summary}</p>
            <p><b>How you apply:</b> {program.learn.how}</p>
            <ul>{program.learn.links.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{label} ↗</a></li>)}</ul>
          </details>
        </div>
        <div className="doc-progress" aria-label={`${done} of 5 sections complete`}><span style={{ width: `${(done / 5) * 100}%` }} /></div>
        <div className="doc-scroll" ref={docRef}>
          <PlanDocument {...p} sections={['area', 'need', 'access', 'space', 'partners']} current={plan.step} onJump={goTo} />
        </div>
      </section>
    </div>
  )
}
