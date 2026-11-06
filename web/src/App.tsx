import { useEffect, useMemo, useState } from 'react'
import './App.css'
import MapView from './components/MapView'
import WeightSliders from './components/WeightSliders'
import RankedList from './components/RankedList'
import TractDetail from './components/TractDetail'
import SourcesDialog from './components/SourcesDialog'
import MapKey from './components/MapKey'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import SitePlanPanel from './components/plan/SitePlanPanel'
import PrintDoc from './components/plan/PrintDoc'
import type { MapMode, PrintRequest, StepProps } from './components/plan/types'
import { DEFAULT_PRESET, PRESETS, scoreTract, topSites } from './lib/score'
import type { Weights } from './lib/score'
import { loadPlans, newPlan, savePlans, summarize } from './lib/plan'
import type { ProgramId } from './lib/programs'
import { buildPlaces } from './lib/search'
import type { Place } from './lib/search'
import { nearestTown } from './lib/geo'
import type { SitePlan } from './lib/plan'
import type { Facilities, FacilityType, Hospital, Land, LandProps, Meta, Site, Tracts } from './lib/types'

const SITES_KEY = 'hersite.sites'

function loadSites(): Site[] {
  try {
    return JSON.parse(localStorage.getItem(SITES_KEY) ?? '[]')
  } catch {
    return []
  }
}

export default function App() {
  const [raw, setRaw] = useState<{ tracts: Tracts; facilities: Facilities; land: Land; hospitals: Hospital[]; meta: Meta } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [weights, setWeights] = useState<Weights>(PRESETS[DEFAULT_PRESET])
  const [county, setCounty] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [visible, setVisible] = useState<Record<FacilityType, boolean>>({
    health_center: true, family_planning: true, birthing_hospital: true, ld_closed: true, mammography: false,
  })
  const [landVisible, setLandVisible] = useState<Record<LandProps['status'], boolean>>({ open: true, recent: true })
  const [sites, setSites] = useState<Site[]>(loadSites)
  const [placing, setPlacing] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [plans, setPlans] = useState<SitePlan[]>(loadPlans)
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [mapMode, setMapMode] = useState<MapMode>('explore')
  const [printing, setPrinting] = useState<PrintRequest | null>(null)
  const dark = false

  useEffect(() => {
    Promise.all(['tracts.geojson', 'facilities.geojson', 'land.geojson', 'hospitals.json', 'meta.json'].map((f) =>
      fetch(`${import.meta.env.BASE_URL}data/${f}`).then((r) => {
        if (!r.ok) throw new Error(`${f}: ${r.status}`)
        return r.json()
      })))
      .then(([tracts, facilities, land, hospitals, meta]) => setRaw({ tracts, facilities, land, hospitals, meta }))
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SITES_KEY, JSON.stringify(sites))
    } catch { /* storage unavailable: sites last for this visit only */ }
  }, [sites])

  useEffect(() => savePlans(plans), [plans])

  const scored = useMemo<Tracts | null>(() => {
    if (!raw) return null
    const scores = raw.tracts.features.map((f) => scoreTract(f.properties, weights))
    // Statewide rank (0-1) of each score, used to spread the map colors evenly.
    const sorted = scores.filter((s): s is number => s != null).sort((a, b) => a - b)
    const rankOf = (s: number) => {
      let lo = 0, hi = sorted.length
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < s) lo = mid + 1; else hi = mid }
      return lo / (sorted.length - 1)
    }
    return {
      type: 'FeatureCollection',
      features: raw.tracts.features.map((f, i) => {
        const score = scores[i]
        return { ...f, properties: score == null ? f.properties : { ...f.properties, score, score_rank: rankOf(score) } }
      }),
    }
  }, [raw, weights])

  const top = useMemo(() => {
    if (!scored) return []
    const pool = scored.features.map((f) => f.properties).filter((t) => !county || t.county_fips === county)
    return topSites(pool)
  }, [scored, county])

  const selected = useMemo(
    () => scored?.features.find((f) => f.properties.GEOID === selectedId)?.properties ?? null,
    [scored, selectedId],
  )

  // Site plan: the active plan, its service-area tracts, and summaries to compare against.
  const allTracts = useMemo(() => raw?.tracts.features.map((f) => f.properties) ?? [], [raw])
  const stateStats = useMemo(() => summarize(allTracts.filter((t) => t.rankable)), [allTracts])
  const plan = plans.find((x) => x.id === activePlanId) ?? null
  const planZips = plan?.zips.join(',')
  const planTract = plan?.tract
  const area = useMemo(() => {
    const zips = new Set(planZips?.split(',') ?? [])
    return allTracts.filter((t) => t.zcta && zips.has(t.zcta))
  }, [allTracts, planZips])
  const planCounty = allTracts.find((t) => t.GEOID === planTract)?.county_fips
  const countyStats = useMemo(() => summarize(allTracts.filter((t) => t.county_fips === planCounty)), [allTracts, planCounty])
  const areaStats = useMemo(() => summarize(area), [area])
  const places = useMemo(
    () => (raw ? buildPlaces(allTracts, raw.facilities.features, (f) => raw.meta.counties[f] ?? f) : []),
    [raw, allTracts],
  )
  const areaGeoids = useMemo(() => (plan ? area.map((t) => t.GEOID) : null), [plan ? 1 : 0, area]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="loading">Couldn't load map data ({error}). Run the data pipeline first.</div>
  if (!raw || !scored) return <div className="loading">Loading California tracts…</div>

  const { meta } = raw
  const countyName = (fips: string) => meta.counties[fips] ?? fips
  const rank = selected ? top.findIndex((t) => t.GEOID === selected.GEOID) : -1

  const updatePlan = (patch: Partial<SitePlan>) =>
    setPlans((all) => all.map((x) => (x.id === activePlanId ? { ...x, ...patch } : x)))

  const townOf = (t: { lat: number; lon: number }) => nearestTown(raw.facilities.features, t.lat, t.lon)

  function startPlan(geoid: string, at?: { lat: number; lon: number }, label?: string, program: ProgramId = 'hrsa') {
    const t = allTracts.find((x) => x.GEOID === geoid)
    if (!t) return
    const p = newPlan(t, allTracts, `Women's health site · ${label ?? townOf(at ?? t)}`, at, program)
    setPlans((all) => [...all, p])
    setActivePlanId(p.id)
    setSelectedId(null)
    window.scrollTo({ top: 0 })
  }

  function planFromPlace(place: Place, focus: string) {
    setWeights(PRESETS[focus] ?? PRESETS[DEFAULT_PRESET])
    startPlan(place.tract, { lat: place.lat, lon: place.lon }, place.kind === 'Town' ? place.label : undefined)
  }

  function openPlan(id: string) {
    setActivePlanId(id)
    setMapMode('explore')
    window.scrollTo({ top: 0 })
  }

  function exitPlan() {
    setActivePlanId(null)
    setMapMode('explore')
  }

  function onMapTract(geoid: string) {
    if (!plan || mapMode !== 'zip') return setSelectedId(geoid)
    const z = allTracts.find((t) => t.GEOID === geoid)?.zcta
    if (!z) return
    updatePlan({ zips: plan.zips.includes(z) ? plan.zips.filter((x) => x !== z) : [...plan.zips, z].sort() })
  }

  function onMapPoint(lat: number, lon: number) {
    if (plan && mapMode === 'site') {
      updatePlan({ site: { ...plan.site, lat, lon }, chosenSpace: null })
      setMapMode('explore')
    }
  }

  const counties = [...new Set((area.length ? area : allTracts.filter((t) => t.GEOID === planTract)).map((t) => countyName(t.county_fips)))]
  const stepProps: StepProps | null = plan && {
    plan, update: updatePlan, all: allTracts, area, stats: { area: areaStats, county: countyStats, state: stateStats },
    counties, meta, countyName, facilities: raw.facilities.features, land: raw.land.features, hospitals: raw.hospitals,
    sites, mapMode, setMapMode, print: (sections, programId) => setPrinting({ sections, programId }),
  }

  function placeSite(lat: number, lon: number) {
    const name = window.prompt('Name this candidate space (e.g., "Vacant storefront, Main St")', `Candidate space ${sites.length + 1}`)
    setPlacing(false)
    if (name === null) return
    setSites((s) => [...s, { id: crypto.randomUUID(), name: name || `Candidate space ${s.length + 1}`, lat, lon }])
  }

  // In a site plan the map is small and shows only what the current step needs.
  const PLAN_LAYERS: { types: FacilityType[]; land: boolean; caption: string }[] = [
    { types: [], land: false, caption: 'Your service area is outlined. Click an area to add or remove its ZIP code.' },
    { types: [], land: false, caption: 'Shading shows the need score inside your service area.' },
    { types: ['health_center', 'family_planning', 'birthing_hospital', 'mammography'], land: false,
      caption: '★ your site · orange: existing care · green: referral care. Use “Move the site pin” to change it.' },
    { types: [], land: true, caption: '★ your site · blue: public land offered for sale · pins: your candidate spaces.' },
    { types: ['health_center', 'birthing_hospital', 'mammography'], land: false, caption: '★ your site · orange: health centers · green: hospitals and mammography to ask for letters.' },
    { types: [], land: false, caption: '' },
  ]
  const planLayer = plan ? PLAN_LAYERS[plan.step] : null
  const planVisible = planLayer && (Object.fromEntries((Object.keys(visible) as FacilityType[]).map((k) => [k, planLayer.types.includes(k)])) as Record<FacilityType, boolean>)
  const planLand = planLayer && { open: planLayer.land, recent: planLayer.land }
  const fitPoints: [number, number][] | null = plan
    ? [...area.map((t) => [t.lon, t.lat] as [number, number]), [plan.site.lon, plan.site.lat]]
    : null
  const planMap = plan && (
    <MapView tracts={scored} facilities={raw.facilities} visible={planVisible!} land={raw.land} landVisible={planLand!} top={[]} selected={null}
      onSelect={() => {}} sites={planLayer!.land ? sites : []} placingSite={false} onPlaceSite={() => {}}
      countyName={countyName} dark={dark} serviceArea={areaGeoids} sitePin={plan.site}
      mapMode={mapMode} onTract={onMapTract} onPoint={onMapPoint} fitPoints={fitPoints} snapshot />
  )

  const mapView = (
    <div className="map-wrap">
      <MapView tracts={scored} facilities={raw.facilities} visible={visible} land={raw.land} landVisible={landVisible} top={plan ? [] : top} selected={plan ? null : selected}
        onSelect={setSelectedId} sites={sites} placingSite={placing} onPlaceSite={placeSite}
        countyName={countyName} dark={dark} serviceArea={areaGeoids} sitePin={plan?.site ?? null}
        mapMode={mapMode} onTract={onMapTract} onPoint={onMapPoint} />
      <MapKey visible={visible} onToggle={(k) => setVisible((v) => ({ ...v, [k]: !v[k] }))}
        landVisible={landVisible} onToggleLand={(k) => setLandVisible((v) => ({ ...v, [k]: !v[k] }))}
        meta={meta} dark={dark} />
      {placing && <div className="map-banner">Click where a building could host a clinic. <button className="link" onClick={() => setPlacing(false)}>Cancel</button></div>}
      {!placing && plan && mapMode === 'zip' && <div className="map-banner">Click the map to add or remove ZIP codes</div>}
      {!placing && plan && mapMode === 'site' && <div className="map-banner">Click the map to place the site</div>}
    </div>
  )

  return (
    <div className={`app${plan ? ' workspace' : ''}`}>
      <header className="topbar">
        <button className="brand" onClick={exitPlan} aria-label="HerSite home">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" fill="currentColor" /><path d="M12 6v6M9 9h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          </span>
          <span className="brand-name">HerSite</span>
        </button>
        <nav className="top-actions" aria-label="Main">
          {plans.length > 0 && (
            <select value={activePlanId ?? ''} onChange={(e) => (e.target.value ? openPlan(e.target.value) : exitPlan())} aria-label="Site plans">
              <option value="">{plan ? 'Back to map' : 'My site plans'}</option>
              {plans.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          {!plan && <a className="nav-link" href="#explore">Explore map</a>}
          <button className="nav-link" onClick={() => setSourcesOpen(true)}>Data sources</button>
          {!plan && <a className="btn primary" href="#plan" onClick={() => setTimeout(() => document.querySelector<HTMLInputElement>('.search-bar input')?.focus(), 50)}>Plan a site</a>}
        </nav>
      </header>

      {plan && stepProps ? (
        <main className="workspace-main">
          <SitePlanPanel {...stepProps} onExit={exitPlan} map={planMap} mapCaption={planLayer!.caption}
            onDelete={() => { setPlans((all) => all.filter((x) => x.id !== activePlanId)); exitPlan() }} />
        </main>
      ) : (
        <>
          <Hero places={places} plans={plans} onPlan={planFromPlace} onOpenPlan={openPlan} />
          <HowItWorks onSources={() => setSourcesOpen(true)} />
          <section className="explore" id="explore">
            <div className="explore-head">
              <div>
                <h2>Or explore where need is highest</h2>
                <p className="muted">Shaded by need score. Click any area for details.</p>
              </div>
              <div className="explore-tools">
                <select value={county} onChange={(e) => { setCounty(e.target.value); setSelectedId(null) }} aria-label="Filter by county">
                  <option value="">All of California</option>
                  {Object.entries(meta.counties).sort((a, b) => a[1].localeCompare(b[1])).map(([f, n]) => <option key={f} value={f}>{n}</option>)}
                </select>
                <button className={`btn${placing ? ' on' : ''}`} onClick={() => setPlacing((p) => !p)} aria-pressed={placing}>
                  {placing ? 'Click the map…' : '+ Candidate space'}
                </button>
              </div>
            </div>
            <div className="layout">
              {mapView}
              <aside className="sidebar">
                {selected && (
                  <TractDetail t={selected} rank={rank >= 0 ? rank + 1 : null} weights={weights} meta={meta}
                    facilities={raw.facilities.features} land={raw.land.features} sites={sites} countyName={countyName}
                    town={townOf(selected)} onClose={() => setSelectedId(null)} onStartPlan={() => startPlan(selected.GEOID)} />
                )}
                <WeightSliders weights={weights} onChange={setWeights} />
                <RankedList top={top} selected={selectedId} onSelect={setSelectedId} weights={weights} meta={meta}
                  countyName={countyName} townOf={townOf} />
                {sites.length > 0 && (
                  <section className="panel">
                    <div className="panel-title"><h2>Your candidate spaces</h2><span className="muted small">This browser only</span></div>
                    <ul className="sites">
                      {sites.map((x) => (
                        <li key={x.id}>
                          {x.name}
                          <button className="link" onClick={() => setSites((all) => all.filter((y) => y.id !== x.id))}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </aside>
            </div>
          </section>
        </>
      )}
      <SourcesDialog open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
      {printing && stepProps && <PrintDoc {...stepProps} sections={printing.sections} programId={printing.programId} onClose={() => setPrinting(null)} />}
    </div>
  )
}
