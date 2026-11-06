import { NEED_ROWS, csvRow, downloadFile, draftNarrative, fmtStat, statValue } from '../../lib/plan'
import type { StepProps } from './types'

export function NeedTable({ stats, plan, update, countyLabel, editable }: Pick<StepProps, 'stats' | 'plan'> & {
  update?: StepProps['update']; countyLabel: string; editable: boolean
}) {
  const groups = [...new Set(NEED_ROWS.map((r) => r.group))]
  const setLocal = (label: string, field: 'value' | 'source', v: string) => update?.({
    localData: { ...plan.localData, [label]: { value: plan.localData[label]?.value ?? '', source: plan.localData[label]?.source ?? '', [field]: v } },
  })
  return (
    <table className="need-table">
      <thead>
        <tr><th scope="col">Factor</th><th scope="col">Service area</th><th scope="col">{countyLabel}</th><th scope="col">California</th></tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g}>
          <tr className="group-row"><th colSpan={4} scope="colgroup">{g}</th></tr>
          {NEED_ROWS.filter((r) => r.group === g).map((r) => {
            if (r.missing) {
              const local = plan.localData[r.label]
              return (
                <tr key={r.label} className={local?.value ? '' : 'missing'}>
                  <th scope="row">{r.label}<span className="src">{local?.source || 'Not in HerSite: add local data'}</span></th>
                  <td colSpan={3}>
                    {editable ? (
                      <div className="local-inputs">
                        <input placeholder={r.missing} value={local?.value ?? ''} aria-label={`${r.label} value`}
                          onChange={(e) => setLocal(r.label, 'value', e.target.value)} />
                        <input placeholder="Source and year" value={local?.source ?? ''} aria-label={`${r.label} source`}
                          onChange={(e) => setLocal(r.label, 'source', e.target.value)} />
                      </div>
                    ) : (local?.value || 'Not provided')}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={r.label}>
                <th scope="row">{r.label}<span className="src">{r.source}</span></th>
                <td><b>{fmtStat(statValue(stats.area, r.key!), r.unit)}</b></td>
                <td>{fmtStat(statValue(stats.county, r.key!), r.unit)}</td>
                <td>{fmtStat(statValue(stats.state, r.key!), r.unit)}</td>
              </tr>
            )
          })}
        </tbody>
      ))}
    </table>
  )
}

const KEY_GAPS: [string, string][] = [
  ['poverty_pct', 'below poverty'],
  ['uninsured_pct', 'adults uninsured'],
  ['mammo_pct', 'mammogram rate'],
]

export default function NeedStep(p: StepProps) {
  const { plan, update, stats, counties } = p
  const countyLabel = `${p.countyName(p.all.find((t) => t.GEOID === plan.tract)?.county_fips ?? '')} County`
  const draft = () => draftNarrative(stats.area, stats.state, counties, plan.zips)
  const missing = NEED_ROWS.filter((r) => r.missing)
  const filled = missing.filter((r) => plan.localData[r.label]?.value).length

  function downloadCsv() {
    const lines = [csvRow(['Group', 'Factor', 'Service area', countyLabel, 'California', 'Source'])]
    for (const r of NEED_ROWS) {
      if (r.missing) {
        const l = plan.localData[r.label]
        lines.push(csvRow([r.group, r.label, l?.value ?? '', '', '', l?.source ?? 'Not provided']))
      } else {
        lines.push(csvRow([r.group, r.label, fmtStat(statValue(stats.area, r.key!), r.unit),
          fmtStat(statValue(stats.county, r.key!), r.unit), fmtStat(statValue(stats.state, r.key!), r.unit), r.source]))
      }
    }
    downloadFile(`${plan.name} - needs assessment data.csv`, lines.join('\n'))
  }

  return (
    <div className="step">
      <p className="step-lede">
        Already filled in for your {plan.zips.length} ZIP codes. Add the few factors HerSite can't fill, then save the summary.
      </p>
      <div className="stat-row">
        {KEY_GAPS.map(([key, label]) => (
          <div key={key}>
            <b>{fmtStat(stats.area.values[key], '%')}</b>
            <span>{label}</span>
            <em>CA {fmtStat(stats.state.values[key], '%')}</em>
          </div>
        ))}
      </div>
      <p className="hint">All {NEED_ROWS.length - missing.length} factors are in your application on the right →</p>

      <h3>Add what HerSite can't fill ({filled} of {missing.length})</h3>
      {missing.map((r) => {
        const local = plan.localData[r.label]
        const set = (field: 'value' | 'source', v: string) => update({
          localData: { ...plan.localData, [r.label]: { value: local?.value ?? '', source: local?.source ?? '', [field]: v } },
        })
        return (
          <div key={r.label} className={`local-row${local?.value ? ' filled' : ''}`}>
            <span className="local-label">{r.label}</span>
            <div className="local-inputs">
              <input placeholder={r.missing} value={local?.value ?? ''} aria-label={`${r.label} value`} onChange={(e) => set('value', e.target.value)} />
              <input placeholder="Source and year" value={local?.source ?? ''} aria-label={`${r.label} source`} onChange={(e) => set('source', e.target.value)} />
            </div>
          </div>
        )
      })}

      <h3>Summary paragraph</h3>
      <p className="hint">Drafted from your area's numbers. Edit freely.</p>
      <textarea className="narrative" rows={8} value={plan.narrative || draft()}
        onChange={(e) => update({ narrative: e.target.value })} aria-label="Needs assessment summary" />
      <div className="step-actions">
        {plan.narrative ? (
          <>
            <span className="hint">Saved.</span>
            <button className="btn ghost small" onClick={() => update({ narrative: draft() })}>Redraft from data</button>
          </>
        ) : (
          <button className="btn small" onClick={() => update({ narrative: draft() })}>Use this summary</button>
        )}
      </div>
      <div className="step-actions">
        <button className="btn ghost small" onClick={downloadCsv}>Download data (CSV)</button>
      </div>
    </div>
  )
}
