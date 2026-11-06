import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, Popup, Source, NavigationControl } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import type { ExpressionSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Facilities, FacilityType, Land, LandProps, Site, TractProps, Tracts } from '../lib/types'
import { FACILITY_STYLE, LAND_STYLE, ROLE_STYLE, SCORE_RAMP, SCORE_RAMP_DARK } from '../lib/style'

interface Props {
  tracts: Tracts
  facilities: Facilities
  visible: Record<FacilityType, boolean>
  land: Land
  landVisible: Record<LandProps['status'], boolean>
  top: TractProps[]
  selected: TractProps | null
  onSelect: (geoid: string | null) => void
  sites: Site[]
  placingSite: boolean
  onPlaceSite: (lat: number, lon: number) => void
  countyName: (fips: string) => string
  dark: boolean
  /** Site plan: tracts in the service area, the site location, and what a map click does. */
  serviceArea: string[] | null
  sitePin: { lat: number; lon: number } | null
  mapMode: 'explore' | 'zip' | 'site'
  onTract: (geoid: string) => void
  onPoint: (lat: number, lon: number) => void
  /** Plan mode: zoom to these points (the service area) and gray out tracts outside it. */
  fitPoints?: [number, number][] | null
  /** Keep the canvas readable so the map can be saved into the report. */
  snapshot?: boolean
}

const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// Unranked tracts have no `score_rank` property and render as a faint gray.
// With a service area, tracts outside it are grayed out so the area stands out.
const fillColor = (ramp: [number, string][], area: string[] | null) => {
  const ranked = ['case',
    ['!', ['has', 'score_rank']], 'rgba(137,135,129,0.25)',
    ['interpolate', ['linear'], ['get', 'score_rank'], ...ramp.flat()]]
  return (area ? ['case', ['in', ['get', 'GEOID'], ['literal', area]], ranked, 'rgba(137,135,129,0.12)'] : ranked) as unknown as ExpressionSpecification
}

export default function MapView(p: Props) {
  const map = useRef<MapRef>(null)
  const [hover, setHover] = useState<{ lon: number; lat: number; t: TractProps } | null>(null)
  const [facHover, setFacHover] = useState<{ lon: number; lat: number; name: string; detail: string } | null>(null)

  // Fly to a tract when it's picked from the list.
  useEffect(() => {
    if (p.selected) map.current?.flyTo({ center: [p.selected.lon, p.selected.lat], zoom: Math.max(map.current.getZoom(), 10), duration: 900 })
  }, [p.selected?.GEOID]) // eslint-disable-line react-hooks/exhaustive-deps

  // Plan mode: keep the whole service area in view, refitting when it changes.
  const fitKey = p.fitPoints?.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join('|') ?? ''
  function fit(animate: boolean) {
    const pts = p.fitPoints
    if (!map.current || !pts?.length) return
    const xs = pts.map((q) => q[0])
    const ys = pts.map((q) => q[1])
    map.current.fitBounds([[Math.min(...xs) - 0.03, Math.min(...ys) - 0.03], [Math.max(...xs) + 0.03, Math.max(...ys) + 0.03]],
      { padding: 24, maxZoom: 12, duration: animate ? 700 : 0 })
  }
  useEffect(() => fit(true), [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const facilityLayers = useMemo(() => (Object.keys(FACILITY_STYLE) as FacilityType[]).filter((k) => p.visible[k]), [p.visible])
  const landLayers = (Object.keys(LAND_STYLE) as LandProps['status'][]).filter((k) => p.landVisible[k]).map((k) => `land-${k}`)
  const landColor = p.dark ? ROLE_STYLE.land.darkColor : ROLE_STYLE.land.color
  const surface = p.dark ? '#1a1a19' : '#fcfcfb'

  function onClick(e: MapLayerMouseEvent) {
    if (p.placingSite) {
      p.onPlaceSite(e.lngLat.lat, e.lngLat.lng)
      return
    }
    if (p.mapMode === 'site') {
      p.onPoint(e.lngLat.lat, e.lngLat.lng)
      return
    }
    const f = e.features?.find((x) => x.layer.id === 'tract-fill')
    if (f) p.onTract((f.properties as TractProps).GEOID)
    else if (p.mapMode === 'explore') p.onSelect(null)
  }

  function onMove(e: MapLayerMouseEvent) {
    const land = e.features?.find((x) => x.layer.id.startsWith('land-'))
    if (land) {
      const l = land.properties as LandProps
      const [lon, lat] = (land.geometry as GeoJSON.Point).coordinates
      const size = l.acres != null ? `${l.acres} acres · ` : ''
      setFacHover({
        lon, lat, name: [l.address, l.city].filter(Boolean).join(', ') || l.agency,
        detail: `${LAND_STYLE[l.status].label} · ${size}${l.use} · offered by ${l.agency}`,
      })
      setHover(null)
      return
    }
    const fac = e.features?.find((x) => x.layer.id.startsWith('fac-'))
    if (fac) {
      const [lon, lat] = (fac.geometry as GeoJSON.Point).coordinates
      setFacHover({ lon, lat, name: fac.properties.name, detail: fac.properties.detail })
      setHover(null)
      return
    }
    setFacHover(null)
    const f = e.features?.find((x) => x.layer.id === 'tract-fill')
    setHover(f ? { lon: e.lngLat.lng, lat: e.lngLat.lat, t: f.properties as TractProps } : null)
  }

  return (
    <Map
      ref={map}
      initialViewState={p.sitePin
        ? { longitude: p.sitePin.lon, latitude: p.sitePin.lat, zoom: 9.2 }
        : { longitude: -119.4, latitude: 37.2, zoom: 5.2 }}
      mapStyle={p.dark ? STYLE_DARK : STYLE_LIGHT}
      onLoad={() => fit(false)}
      canvasContextAttributes={p.snapshot ? { preserveDrawingBuffer: true } : undefined}
      interactiveLayerIds={['tract-fill', ...facilityLayers.map((k) => `fac-${k}`), ...landLayers]}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={() => { setHover(null); setFacHover(null) }}
      cursor={p.placingSite || p.mapMode === 'site' ? 'crosshair' : hover || facHover ? 'pointer' : 'grab'}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      <Source id="tracts" type="geojson" data={p.tracts}>
        <Layer id="tract-fill" type="fill"
          paint={{ 'fill-color': fillColor(p.dark ? SCORE_RAMP_DARK : SCORE_RAMP, p.fitPoints ? p.serviceArea : null), 'fill-opacity': 0.72 }} />
        <Layer id="tract-line" type="line"
          paint={{ 'line-color': p.dark ? '#1a1a19' : '#fcfcfb', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0, 10, 0.6] }} />
        {/* Service area: an empty list when no plan is open (Source only wires up its direct children, so no fragment). */}
        <Layer id="area-fill" type="fill" filter={['in', ['get', 'GEOID'], ['literal', p.serviceArea ?? []]]}
          paint={{ 'fill-color': p.dark ? '#f0efec' : '#0b0b0b', 'fill-opacity': 0.2 }} />
        <Layer id="area-line" type="line" filter={['in', ['get', 'GEOID'], ['literal', p.serviceArea ?? []]]}
          paint={{ 'line-color': p.dark ? '#f0efec' : '#0b0b0b', 'line-width': 2, 'line-opacity': 0.9 }} />
        <Layer id="tract-selected" type="line" filter={['==', ['get', 'GEOID'], p.selected?.GEOID ?? '']}
          paint={{ 'line-color': p.dark ? '#f0efec' : '#0b0b0b', 'line-width': 2.5 }} />
      </Source>

      <Source id="facilities" type="geojson" data={p.facilities}>
        {facilityLayers.map((k) => {
          const s = FACILITY_STYLE[k]
          const color = k === 'ld_closed' ? (p.dark ? '#f0efec' : '#0b0b0b') : ROLE_STYLE[s.role].color
          return (
            <Layer key={k} id={`fac-${k}`} type="circle" filter={['==', ['get', 'type'], k]}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, s.radius * 0.6, 10, s.radius, 14, s.radius * 1.5],
                'circle-color': s.hollow ? surface : color,
                'circle-stroke-color': s.hollow ? color : surface,
                'circle-stroke-width': s.hollow ? 2 : 1.5,
              }} />
          )
        })}
      </Source>

      <Source id="land" type="geojson" data={p.land}>
        {landLayers.map((id) => {
          const s = LAND_STYLE[id.slice(5) as LandProps['status']]
          return (
            <Layer key={id} id={id} type="circle" filter={['==', ['get', 'status'], id.slice(5)]}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, s.radius * 0.6, 10, s.radius, 14, s.radius * 1.5],
                'circle-color': s.hollow ? surface : landColor,
                'circle-stroke-color': s.hollow ? landColor : surface,
                'circle-stroke-width': s.hollow ? 2 : 1.5,
              }} />
          )
        })}
      </Source>

      {p.top.map((t, i) => (
        <Marker key={t.GEOID} longitude={t.lon} latitude={t.lat} anchor="center"
          onClick={(e) => { e.originalEvent.stopPropagation(); p.onSelect(t.GEOID) }}>
          <div className={`rank-badge${p.selected?.GEOID === t.GEOID ? ' active' : ''}`} title={`#${i + 1}`}>{i + 1}</div>
        </Marker>
      ))}

      {p.sites.map((s) => (
        <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="bottom">
          <div className="site-pin" title={s.name}>
            <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
              <path d="M11 1C5.5 1 1 5.4 1 10.8 1 18 11 27 11 27s10-9 10-16.2C21 5.4 16.5 1 11 1z" />
              <rect x="7" y="7" width="8" height="7" rx="1" />
            </svg>
          </div>
        </Marker>
      ))}

      {p.sitePin && (
        <Marker longitude={p.sitePin.lon} latitude={p.sitePin.lat} anchor="center">
          <div className="site-star" title="Planned site" aria-label="Planned site">★</div>
        </Marker>
      )}

      {hover && !p.placingSite && (
        <Popup longitude={hover.lon} latitude={hover.lat} closeButton={false} offset={12} className="map-tip">
          <strong>{p.countyName(hover.t.county_fips)} County</strong>
          <div>{hover.t.score == null ? 'Too few residents to rank' : `Need score ${(hover.t.score * 100).toFixed(0)} / 100`}</div>
          {p.mapMode === 'zip' && hover.t.zcta && (
            <div className="muted">ZIP {hover.t.zcta} · click to {p.serviceArea?.includes(hover.t.GEOID) ? 'remove' : 'add'}</div>
          )}
          {hover.t.women_total != null && <div className="muted">{Math.round(hover.t.women_total).toLocaleString()} women</div>}
        </Popup>
      )}
      {facHover && (
        <Popup longitude={facHover.lon} latitude={facHover.lat} closeButton={false} offset={10} className="map-tip">
          <strong>{facHover.name}</strong>
          <div className="muted">{facHover.detail}</div>
        </Popup>
      )}
    </Map>
  )
}
