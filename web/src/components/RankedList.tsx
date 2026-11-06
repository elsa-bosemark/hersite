import type { Meta, TractProps } from '../lib/types'
import { reasons } from '../lib/score'
import type { Weights } from '../lib/score'

interface Props {
  top: TractProps[]
  selected: string | null
  onSelect: (geoid: string) => void
  weights: Weights
  meta: Meta
  countyName: (fips: string) => string
  townOf: (t: TractProps) => string
}

export default function RankedList({ top, selected, onSelect, weights, meta, countyName, townOf }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Top 10 places</h2>
        <span className="muted small">Need score</span>
      </div>
      <ol className="ranked">
        {top.map((t, i) => {
          const why = reasons(t, weights, meta).find((r) => !r.endsWith('women live here'))
          return (
            <li key={t.GEOID}>
              <button className={`rank-row${selected === t.GEOID ? ' on' : ''}`} onClick={() => onSelect(t.GEOID)}>
                <span className="rank-num">{i + 1}</span>
                <span className="rank-body">
                  <span className="rank-title">Near {townOf(t)}</span>
                  <span className="rank-why">{countyName(t.county_fips)} County{why ? ` · ${why}` : ''}</span>
                </span>
                <span className="rank-score">{(t.score! * 100).toFixed(0)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
