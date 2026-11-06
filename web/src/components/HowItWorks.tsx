import { PROGRAMS, PROGRAM_ORDER } from '../lib/programs'

const STEPS = [
  { n: 1, title: 'Pick your area', text: 'Type a town, ZIP code or county. Adjust the ZIP codes on the map.' },
  { n: 2, title: 'Prove the need', text: 'Low-income women, insurance, transportation and screening, filled in for you.' },
  { n: 3, title: 'Site, space & partners', text: 'Place the site, save a coverage map, find space, track partner letters.' },
  { n: 4, title: 'Download your evidence', text: 'One plan becomes a version for each funder, as PDFs.' },
]

/** What each funder asks for, row by row. The same HerSite step answers each row. */
const ROWS: { ask: string; step: string; cells: Record<string, string> }[] = [
  {
    ask: 'Service area', step: 'Step 1',
    cells: { titlex: 'Proposed service area and boundaries', hrsa: 'ZIP codes on Form 5B', calrht: 'Rural service area' },
  },
  {
    ask: 'Need', step: 'Step 2',
    cells: { titlex: 'Need, especially low-income: 25 of 100 points', hrsa: 'Assessment of unmet need (ch. 3)', calrht: 'Community need' },
  },
  {
    ask: 'Site & access', step: 'Step 3',
    cells: { titlex: 'Coverage map; each site\'s hours and clients', hrsa: 'Accessible location and hours (ch. 6)', calrht: 'Access and distance to care' },
  },
  {
    ask: 'Partners', step: 'Step 5',
    cells: { titlex: 'Letters of commitment from referral partners', hrsa: 'Letters of support or outreach record (ch. 14)', calrht: 'Project partners' },
  },
]

/** The landing page's explainer: the four steps, what each funder asks, and why the data can be trusted. */
export default function HowItWorks({ onSources }: { onSources: () => void }) {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="how-inner">
        <p className="hero-kicker">For women's health clinics and community health centers in California</p>
        <h2 id="how-title">One site plan, the evidence every funder asks for</h2>
        <p className="how-lede">
          Funders ask the same questions in different words: where you'll serve, how great the need is, whether the site is easy
          to reach, and who will work with you. HerSite answers them once, from free public data.
        </p>

        <ol className="timeline">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="timeline-num" aria-hidden="true">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="funders">
          <h3 className="funders-title">What each funder asks for, and where HerSite fills it in</h3>
          <div className="funder-scroll">
            <table className="funder-table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Requirement</span></th>
                  {PROGRAM_ORDER.map((id) => (
                    <th key={id} scope="col" className={id === 'titlex' ? 'lead' : ''}>
                      <span className="funder-who">{PROGRAMS[id].who}</span>
                      <span className="funder-name">{PROGRAMS[id].name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.ask}>
                    <th scope="row"><b>{r.ask}</b><span>{r.step}</span></th>
                    {PROGRAM_ORDER.map((id) => <td key={id} className={id === 'titlex' ? 'lead' : ''}>{r.cells[id]}</td>)}
                  </tr>
                ))}
                <tr className="funder-notes">
                  <th scope="row"><span>Notes</span></th>
                  {PROGRAM_ORDER.map((id) => (
                    <td key={id} className={id === 'titlex' ? 'lead' : ''}>
                      {PROGRAMS[id].notes}{' '}
                      <a href={PROGRAMS[id].link} target="_blank" rel="noreferrer" className="link">About {PROGRAMS[id].short} ↗</a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="trust-row">
          <span>✓ Each funder's own requirements, with every number's source shown</span>
          <span>✓ Free public data from Census, CDC, HRSA and California agencies</span>
          <span>✓ No sign-up, no patient data</span>
          <button className="link" onClick={onSources}>Data sources →</button>
        </div>
      </div>
    </section>
  )
}
