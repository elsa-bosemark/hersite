import { useState } from 'react'
import { NEED_ROWS } from '../../lib/plan'
import { PROGRAMS, PROGRAM_ORDER } from '../../lib/programs'
import { downloadAllVersions } from '../../lib/exportVersions'
import type { SitePlan } from '../../lib/plan'
import { buildPartners } from './PartnersStep'
import type { StepProps } from './types'

export interface CheckItem {
  step: number
  title: string
  done: boolean
  detail: string
}

export function checklist(p: StepProps): CheckItem[] {
  const { plan } = p
  const missing = NEED_ROWS.filter((r) => r.missing)
  const filled = missing.filter((r) => plan.localData[r.label]?.value).length
  const partners = buildPartners(p)
  const contacted = partners.filter((x) => (plan.partners[x.id]?.status ?? 'Not asked') !== 'Not asked').length
  const received = partners.filter((x) => plan.partners[x.id]?.status === 'Received').length
  return [
    { step: 0, title: 'Service area defined', done: plan.zips.length > 0, detail: `${plan.zips.length} ZIP codes` },
    { step: 1, title: 'Unmet need documented', done: Boolean(plan.narrative), detail: plan.narrative ? `Summary written · ${filled} of ${missing.length} local factors added` : 'Review and save the summary paragraph' },
    { step: 2, title: 'Site location and hours', done: Boolean(plan.site.address && plan.hours), detail: [plan.site.address || 'No address yet', plan.hours || 'No hours yet'].join(' · ') },
    { step: 3, title: 'Space chosen', done: Boolean(plan.chosenSpace), detail: plan.chosenSpace ? plan.site.address : 'Choose a space from your shortlist' },
    { step: 4, title: 'Partners contacted', done: partners.length > 0 && contacted === partners.length, detail: `${contacted} of ${partners.length} contacted · ${received} letters received` },
  ]
}

export function planProgress(items: CheckItem[]) {
  return items.filter((i) => i.done).length
}

export default function PacketStep(p: StepProps & { goTo: (step: number) => void }) {
  const items = checklist(p)
  const [busy, setBusy] = useState<string | null>(null)
  return (
    <div className="step">
      <p className="step-lede">You filled this in once. Here it is in each funder's terms. Preview any version, or download all three.</p>
      <ul className="versions">
        {PROGRAM_ORDER.map((id) => (
          <li key={id}>
            <span>
              <b>{PROGRAMS[id].name}</b>
              <span className="near-type">{PROGRAMS[id].who}</span>
            </span>
            <button className="btn small" onClick={() => p.print(['area', 'need', 'access', 'space', 'partners'], id)}>Preview</button>
          </li>
        ))}
      </ul>
      <button className="btn primary block" disabled={!!busy}
        onClick={async () => { try { await downloadAllVersions(p, setBusy) } finally { setBusy(null) } }}>
        {busy ?? 'Download all 3 as PDFs (ZIP)'}
      </button>
      <h3>Before you submit</h3>
      <ul className="checklist">
        {items.map((i) => (
          <li key={i.title} className={i.done ? 'done' : ''}>
            <span className="check" aria-hidden="true">{i.done ? '✓' : ''}</span>
            <span>
              <span className="near-name">{i.title}<span className="sr-only">{i.done ? ' (done)' : ' (to do)'}</span></span>
              <span className="near-type">{i.detail}</span>
            </span>
            <button className="link" onClick={() => p.goTo(i.step)}>{i.done ? 'Review' : 'Finish'}</button>
          </li>
        ))}
      </ul>
      <p className="hint">
        HerSite drafts these documents from public data. Review every number before you submit; your HRSA application itself
        is filed through Grants.gov and HRSA's EHBs.
      </p>
    </div>
  )
}

export const planTitle = (plan: SitePlan) => plan.name || 'Untitled site plan'
