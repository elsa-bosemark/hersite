import { PROGRAMS, PROGRAM_ORDER } from '../lib/programs'

const STEPS = [
  { n: 1, title: 'Pick your area', text: 'Type a town, ZIP code or county. HerSite proposes a service area of ZIP codes you can adjust on the map.' },
  { n: 2, title: 'Prove the need', text: 'Low-income women, insurance, transportation, screening rates and distance to care, compared with the county and the state.' },
  { n: 3, title: 'Site, space & partners', text: 'Place the site, save a coverage map, find public land for sale, and track letters from referral partners.' },
  { n: 4, title: 'Download your evidence', text: 'Every step fills in one document, labeled for the funder you chose, ready to use in your application.' },
]

/** What each funder asks for, in its own words: the reason one plan can serve several applications. */
const ASKS: Record<string, string[]> = {
  titlex: ['Service area and need, especially low-income (25 of 100 points)', 'Coverage map of sites vs. need', 'Site location, hours and estimated clients', 'Letters of commitment from referral partners'],
  hrsa: ['Service area by ZIP code (Form 5B)', 'Assessment of unmet need (ch. 3)', 'Accessible location and hours (ch. 6)', 'Letters of support or documented outreach (ch. 14)'],
  calrht: ['Rural service area and community need', 'Access and distance to care', 'Project site', 'Partners'],
}

/** The landing page's explainer: who HerSite is for, what each funder asks for, and why the data can be trusted. */
export default function HowItWorks({ onSources }: { onSources: () => void }) {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="how-inner">
        <p className="hero-kicker">For women's health clinics and community health centers in California</p>
        <h2 id="how-title">One site plan, the evidence every funder asks for</h2>
        <p className="how-lede">
          Whether you're a family planning clinic applying for <b>Title X</b>, a community health center adding a site through
          <b> HRSA's Health Center Program</b>, or a rural provider applying for <b>CalRHT</b>, funders ask the same questions:
          where you'll serve, how great the need is, whether the site is easy to reach, and who will work with you.
          HerSite answers them from free public data.
        </p>
        <ol className="how-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="how-num" aria-hidden="true">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="programs">
          {PROGRAM_ORDER.map((id, i) => {
            const pr = PROGRAMS[id]
            return (
              <article key={id} className={`program-card${i === 0 ? ' lead' : ''}`}>
                <p className="program-who">{pr.who}</p>
                <h3>{pr.name}</h3>
                <ul>{ASKS[id].map((a) => <li key={a}>{a}</li>)}</ul>
                <p className="hint">{pr.notes}</p>
                <a href={pr.link} target="_blank" rel="noreferrer" className="link">About {pr.short} ↗</a>
              </article>
            )
          })}
        </div>

        <div className="how-card soft trust">
          <h3>Built to be trusted</h3>
          <ul className="trust-list">
            <li>Organized around each funder's own requirements, with every number's source and year shown</li>
            <li>Free public data from Census, CDC, HRSA and California agencies</li>
            <li>No sign-up and no patient data. Plans stay in your browser</li>
          </ul>
          <button className="link" onClick={onSources}>See all data sources →</button>
        </div>
      </div>
    </section>
  )
}
