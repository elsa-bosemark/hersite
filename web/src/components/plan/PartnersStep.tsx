import { useState } from 'react'
import { kmBetween } from '../../lib/geo'
import { PARTNER_STATUSES, csvRow, downloadFile } from '../../lib/plan'
import type { PartnerStatus, SitePlan } from '../../lib/plan'
import type { StepProps } from './types'

export interface Partner {
  id: string
  name: string
  kind: string
  why: string
  contact: string
  km: number | null
}

const LHD_DIRECTORY = 'https://www.cdph.ca.gov/Pages/LocalHealthServicesAndOffices.aspx'

/** Who HRSA ch. 14 expects letters from: other health centers, hospitals, the health department, referral partners. */
export function buildPartners(p: Pick<StepProps, 'plan' | 'facilities' | 'hospitals' | 'counties'>): Partner[] {
  const { lat, lon } = p.plan.site
  const radius = Math.max(p.plan.radiusKm, 20)
  const own = p.plan.org.trim().toLowerCase()
  const out: Partner[] = []

  // Other health center organizations with a site nearby (one row per organization).
  const orgs = new Map<string, Partner>()
  for (const f of p.facilities) {
    if (f.properties.type !== 'health_center' || !f.properties.org) continue
    const [flon, flat] = f.geometry.coordinates
    const km = kmBetween(lat, lon, flat, flon)
    const org = f.properties.org
    if (km > radius || (own && org.toLowerCase().includes(own))) continue
    const prev = orgs.get(org)
    if (!prev || km < (prev.km ?? Infinity)) {
      orgs.set(org, {
        id: `hc:${org}`, name: org, kind: 'Health center',
        why: 'Serves the same area. HRSA expects you to coordinate with other health centers.',
        contact: [`Nearest site: ${f.properties.name}, ${f.properties.city}`, f.properties.phone].filter(Boolean).join(' · '), km,
      })
    }
  }
  out.push(...[...orgs.values()].sort((a, b) => a.km! - b.km!).slice(0, 8))

  // Local hospitals, plus the nearest one that delivers babies for referrals.
  const hospitals = p.hospitals.map((h) => ({ h, km: kmBetween(lat, lon, h.lat, h.lon) })).sort((a, b) => a.km - b.km)
  const local = hospitals.filter((x) => x.km <= radius).slice(0, 6)
  const birth = hospitals.find((x) => x.h.births)
  for (const { h, km } of [...local, ...(birth && !local.some((x) => x.h === birth.h) ? [birth] : [])]) {
    out.push({
      id: `hosp:${h.name}:${h.city}`, name: h.name, kind: h.rural ? 'Rural hospital' : 'Hospital',
      why: h.births ? 'Hospital admitting, and where patients deliver babies.' : 'Hospital admitting, ER follow-up and specialist referrals.',
      contact: [`${h.address}, ${h.city}`, h.phone].filter(Boolean).join(' · '), km,
    })
  }

  // Nearest mammography sites for referrals.
  const mammo = p.facilities.filter((f) => f.properties.type === 'mammography')
    .map((f) => ({ f, km: kmBetween(lat, lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) }))
    .sort((a, b) => a.km - b.km).slice(0, 2)
  for (const { f, km } of mammo) {
    out.push({
      id: `mammo:${f.properties.name}:${f.properties.city}`, name: f.properties.name, kind: 'Mammography',
      why: 'Referral partner for mammograms, or a mobile van on set days.', contact: `${f.properties.address}, ${f.properties.city}`, km,
    })
  }

  // The county public health department for each county the service area touches.
  for (const c of p.counties) {
    out.push({
      id: `lhd:${c}`, name: `${c} County public health department`, kind: 'Health department',
      why: 'HRSA lists health departments among the providers to coordinate with.', contact: `Find contacts: ${LHD_DIRECTORY}`, km: null,
    })
  }

  for (const c of p.plan.customPartners) out.push({ id: c.id, name: c.name, kind: c.kind, why: 'Added by you.', contact: '', km: null })
  return out
}

export function letterRequest(plan: SitePlan, partner: Partner, women: number) {
  const org = plan.org || '[Your organization]'
  // One request that works for every funder: a specific letter of commitment also serves as a letter of support.
  const ask = 'Would you be willing to sign a short letter describing the specific role you would play, such as accepting referrals or the services you would provide, and your experience serving women in this area? A letter with these specifics works for each funder we are applying to.'
  return `Dear ${partner.name} team,

${org} is applying for funding (Title X family planning, HRSA's Health Center Program and California's rural health grants) to open a new women's health site${plan.site.address ? ` at ${plan.site.address}` : ''}, serving ZIP codes ${plan.zips.join(', ')}. About ${Math.round(women).toLocaleString()} women live in this area, and many face long distances to care.

The site would offer well-woman exams, birth control, Pap and HPV screening, STI testing, and prenatal and postpartum care, and would refer patients to partners like you for services we don't provide.

${ask} We'd be glad to share a draft or talk it through.

Thank you,
[Your name]
${org}`
}

export default function PartnersStep(p: StepProps) {
  const { plan, update } = p
  const partners = buildPartners(p)
  const [copied, setCopied] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('Rural health clinic')

  const setStatus = (id: string, status: PartnerStatus) => update({
    partners: { ...plan.partners, [id]: { note: plan.partners[id]?.note ?? '', status, date: new Date().toISOString().slice(0, 10) } },
  })
  const setNote = (id: string, note: string) => update({
    partners: { ...plan.partners, [id]: { status: plan.partners[id]?.status ?? 'Not asked', date: plan.partners[id]?.date ?? '', note } },
  })
  async function copy(partner: Partner) {
    try {
      await navigator.clipboard.writeText(letterRequest(plan, partner, p.stats.area.women))
      setCopied(partner.id)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* clipboard blocked: the template is still in the printed log */ }
  }
  const received = partners.filter((x) => plan.partners[x.id]?.status === 'Received').length
  const contacted = partners.filter((x) => (plan.partners[x.id]?.status ?? 'Not asked') !== 'Not asked').length

  function downloadLog() {
    const lines = [csvRow(['Partner', 'Type', 'Why', 'Contact', 'Status', 'Date', 'Notes'])]
    for (const x of partners) {
      const s = plan.partners[x.id]
      lines.push(csvRow([x.name, x.kind, x.why, x.contact, s?.status ?? 'Not asked', s?.date ?? '', s?.note ?? '']))
    }
    downloadFile(`${plan.name} - collaboration log.csv`, lines.join('\n'))
  }

  return (
    <div className="step">
      <p className="step-lede">
        Every funder wants partners. Title X only counts letters of commitment that name each partner's specific role, so the request asks for that, and it also works as a letter of support for HRSA and CalRHT.
      </p>
      <label className="field">
        <span>Your organization (left off the list)</span>
        <input value={plan.org} placeholder="e.g., San Joaquin Valley Health" onChange={(e) => update({ org: e.target.value })} />
      </label>
      <div className="stat-row">
        <div><b>{partners.length}</b><span>partners to ask</span></div>
        <div><b>{contacted}</b><span>contacted</span></div>
        <div><b>{received}</b><span>letters received</span></div>
      </div>

      <ul className="partner-list">
        {partners.map((x) => {
          const s = plan.partners[x.id]
          return (
            <li key={x.id}>
              <div className="space-head">
                <span>
                  <span className="kind">{x.kind}</span>
                  <span className="near-name">{x.name}{x.km != null && ` · ~${x.km.toFixed(1)} km`}</span>
                  <span className="near-type">{x.why}</span>
                  {x.contact && <span className="near-type">{x.contact}</span>}
                </span>
                <button className="btn small" onClick={() => copy(x)}>{copied === x.id ? 'Copied' : 'Copy letter request'}</button>
              </div>
              <div className="space-controls">
                <select value={s?.status ?? 'Not asked'} onChange={(e) => setStatus(x.id, e.target.value as PartnerStatus)} aria-label="Status">
                  {PARTNER_STATUSES.map((st) => <option key={st}>{st}</option>)}
                </select>
                <input placeholder="Notes (who, how you asked…)" value={s?.note ?? ''} onChange={(e) => setNote(x.id, e.target.value)} />
                {s?.date && <span className="date">{s.date}</span>}
              </div>
            </li>
          )
        })}
      </ul>

      <h3>Add a partner</h3>
      <p className="hint">Rural health clinics, specialists, or community groups HerSite doesn't list.</p>
      <div className="add-partner">
        <input value={newName} placeholder="Name" onChange={(e) => setNewName(e.target.value)} aria-label="Partner name" />
        <select value={newKind} onChange={(e) => setNewKind(e.target.value)} aria-label="Partner type">
          {['Rural health clinic', 'Specialist', 'Community organization', 'Other'].map((k) => <option key={k}>{k}</option>)}
        </select>
        <button className="btn small" disabled={!newName.trim()} onClick={() => {
          update({ customPartners: [...plan.customPartners, { id: `custom:${crypto.randomUUID()}`, name: newName.trim(), kind: newKind }] })
          setNewName('')
        }}>Add</button>
      </div>

      <div className="step-actions">
        <button className="btn" onClick={() => p.print(['partners'])}>Print collaboration log</button>
        <button className="btn ghost" onClick={downloadLog}>Download log (CSV)</button>
      </div>
    </div>
  )
}
