"""Join raw sources into the static files the web app reads.

Outputs (web/public/data/):
  tracts.geojson      CA census tracts with need metrics, nearest-care distances, percentiles
  facilities.geojson  existing care (health centers, family planning) and referral care
                      (birthing hospitals, closed L&D units, mammography)
  meta.json           state averages and source notes

Run after fetch.py: .venv/bin/python data-pipeline/build.py
Needs `npx mapshaper` (Node) to convert and simplify tract shapes.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent
RAW = ROOT / "raw"
OUT = ROOT.parent / "web" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

# Tracts with fewer women than this are mostly parks, airports or water; they're shown but not ranked.
MIN_WOMEN = 300


def load_tracts():
    gaz = pd.read_csv(RAW / "gaz_tracts.txt", sep="\t", dtype={"GEOID": str})
    gaz.columns = gaz.columns.str.strip()
    t = gaz[["GEOID", "INTPTLAT", "INTPTLONG", "ALAND_SQMI"]].rename(
        columns={"INTPTLAT": "lat", "INTPTLONG": "lon", "ALAND_SQMI": "land_sqmi"})
    acs = pd.read_csv(RAW / "acs.csv", dtype={"GEOID": str})
    places = pd.read_csv(RAW / "places.csv", dtype={"GEOID": str}).rename(columns={
        "ACCESS2": "uninsured_pct", "LACKTRPT": "no_transport_pct",
        "MAMMOUSE": "mammo_pct", "CHECKUP": "checkup_pct", "HOUSINSECU": "housing_insecure_pct",
        "DIABETES": "diabetes_pct", "BPHIGH": "bphigh_pct", "DEPRESSION": "depression_pct", "OBESITY": "obesity_pct",
        "FOODINSECU": "food_insecure_pct"})
    t = t.merge(acs, on="GEOID", how="left").merge(places, on="GEOID", how="left").merge(tract_zcta(), on="GEOID", how="left")
    t["county_fips"] = t.GEOID.str[2:5]
    return t


def tract_zcta():
    """Each tract's main ZIP code area (ZCTA): the one covering most of its land."""
    rel = pd.read_csv(RAW / "zcta_tract_rel.txt", sep="|", dtype=str, encoding="utf-8-sig",
                      usecols=["GEOID_ZCTA5_20", "GEOID_TRACT_20", "AREALAND_PART"])
    rel = rel[rel.GEOID_TRACT_20.str.startswith("06") & rel.GEOID_ZCTA5_20.notna()]
    rel["land"] = pd.to_numeric(rel.AREALAND_PART, errors="coerce")
    main = rel.sort_values("land", ascending=False).drop_duplicates("GEOID_TRACT_20")
    return main.rename(columns={"GEOID_TRACT_20": "GEOID", "GEOID_ZCTA5_20": "zcta"})[["GEOID", "zcta"]]


def partner_hospitals():
    """All general acute care hospitals (2025), for the letters-of-support list."""
    d = pd.read_excel(RAW / "hcai_util_2025.xlsx", "Page 1-6").iloc[4:]
    d = d[d.LIC_CAT == "General Acute Care Hospital"]
    births = pd.to_numeric(d.PERINATAL_DISCHARGES, errors="coerce").fillna(0)
    return [{
        "name": str(r.FAC_NAME).title(), "address": str(r.FAC_STR_ADDR).title(), "city": str(r.FAC_CITY).title(),
        "phone": str(r.FAC_PHONE) if isinstance(r.FAC_PHONE, str) else "",
        "lat": float(r.LATITUDE), "lon": float(r.LONGITUDE), "rural": r.RURAL_HOSP == "Yes", "births": bool(b > 0),
    } for r, b in zip(d.itertuples(), births) if pd.notna(pd.to_numeric(r.LATITUDE, errors="coerce"))]


def hospitals():
    """Delivering hospitals in 2025, and units that delivered in 2021 but not in 2025."""
    def read(year, sheet="Page 1-6"):
        d = pd.read_excel(RAW / f"hcai_util_{year}.xlsx", sheet).iloc[4:]  # first 4 rows are headers
        d = d[pd.to_numeric(d.FAC_NO, errors="coerce").notna()]
        d["births"] = pd.to_numeric(d.PERINATAL_DISCHARGES, errors="coerce").fillna(0)
        d["ob_beds"] = pd.to_numeric(d.PERINATAL_LIC_BEDS, errors="coerce").fillna(0)
        return d.set_index("FAC_NO")

    now, before = read(2025), read(2021)
    not_reported = read(2025, "NonResp 1-6").index
    open_ld = now[(now.births > 0) | (now.ob_beds > 0)]
    # Closed: delivered in 2021, reported in 2025 with no maternity beds or discharges.
    # Hospitals that didn't file a 2025 report are kept as open using their 2021 data.
    stopped = before.index[before.births >= 50].difference(open_ld.index)
    unknown = stopped.intersection(not_reported)
    closed = before.loc[stopped.difference(unknown)]
    open_ld = pd.concat([open_ld, before.loc[unknown]])

    def rows(d, kind):
        return pd.DataFrame({
            "type": kind, "name": d.FAC_NAME.str.title(), "address": d.FAC_STR_ADDR.str.title(),
            "city": d.FAC_CITY.str.title(), "lat": pd.to_numeric(d.LATITUDE, errors="coerce"),
            "lon": pd.to_numeric(d.LONGITUDE, errors="coerce"), "detail": d.births.astype(int),
            "county": d.COUNTY,
        })

    out = pd.concat([rows(open_ld, "birthing_hospital"), rows(closed, "ld_closed")])
    out["detail"] = np.where(out.type == "birthing_hospital",
                             "Labor & delivery (~" + out.detail.astype(str) + " maternity discharges)",
                             "Delivered in 2021 (" + out.detail.astype(str)
                             + " maternity discharges); no maternity beds reported in 2025")
    return out


def health_centers():
    h = pd.read_csv(RAW / "hrsa_sites.csv", dtype=str)
    h = h[(h["Site State Abbreviation"] == "CA") & (h["Site Status Description"] == "Active")]
    return pd.DataFrame({
        "type": "health_center", "name": h["Site Name"], "address": h["Site Address"], "city": h["Site City"],
        "lat": pd.to_numeric(h["Geocoding Artifact Address Primary Y Coordinate"], errors="coerce"),
        "lon": pd.to_numeric(h["Geocoding Artifact Address Primary X Coordinate"], errors="coerce"),
        "detail": h["Health Center Name"] + " · " + h["Health Center Location Type Description"].fillna(""),
        "org": h["Health Center Name"].str.title().str.replace(r"\bInc\b", "Inc", regex=True),
        "phone": h["Site Telephone Number"].fillna(""),
    })


def family_planning():
    f = pd.read_csv(RAW / "fpact.csv", dtype=str, encoding="utf-8-sig")
    return pd.DataFrame({
        "type": "family_planning", "name": f["PROVIDER BUSINESS NAME"].str.title(),
        "address": f["ADDRESS LINE 1"].str.title(), "city": f["CITY"].str.title(),
        "lat": pd.to_numeric(f.LATITUDE, errors="coerce"), "lon": pd.to_numeric(f.LONGITUDE, errors="coerce"),
        "detail": "Family PACT provider (birth control, STI testing, family planning)",
    })


def mammography():
    m = pd.read_csv(RAW / "mammography_geocoded.csv", dtype={"zip": str})
    return pd.DataFrame({
        "type": "mammography", "name": m.name, "address": m.addr1, "city": m.city,
        "lat": m.lat, "lon": m.lon, "detail": "FDA-certified mammography facility",
    })


CA_COUNTIES = (
    "Alameda Alpine Amador Butte Calaveras Colusa Contra_Costa Del_Norte El_Dorado Fresno Glenn Humboldt "
    "Imperial Inyo Kern Kings Lake Lassen Los_Angeles Madera Marin Mariposa Mendocino Merced Modoc Mono "
    "Monterey Napa Nevada Orange Placer Plumas Riverside Sacramento San_Benito San_Bernardino San_Diego "
    "San_Francisco San_Joaquin San_Luis_Obispo San_Mateo Santa_Barbara Santa_Clara Santa_Cruz Shasta Sierra "
    "Siskiyou Solano Sonoma Stanislaus Sutter Tehama Trinity Tulare Tuolumne Ventura Yolo Yuba"
).split()


def surplus_land():
    """Public parcels offered under the Surplus Land Act: open now, or offered since 2024.

    Notices are self-reported by local agencies and not verified by HCD. An expired notice
    doesn't mean the parcel sold, so recent ones are kept as "ask the agency" leads.
    """
    d = pd.read_csv(RAW / "sla_notices.csv", dtype=str, encoding="latin-1", keep_default_na=False)
    d = d.apply(lambda c: c.str.strip())
    d["issued"] = pd.to_datetime(d["Date Notice Issued"], format="%m-%d-%Y", errors="coerce")
    d["lat"], d["lon"] = pd.to_numeric(d.y, errors="coerce"), pd.to_numeric(d.x, errors="coerce")
    active = d["NOA Status"] == "Active"
    d = d[(active | (d.issued >= "2024-01-01")) & d.lat.between(32, 42.1) & d.lon.between(-124.6, -114)]
    use = d["Existing Use/Vacancy"].fillna("").str.strip()
    acres = pd.to_numeric(d["Parcel Size (Gross Acres)"].str.replace(",", ""), errors="coerce")
    return [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(r.lon, 5), round(r.lat, 5)]},
        "properties": {
            "status": "open" if r.status == "Active" else "recent",
            "agency": r.agency or "Local agency", "address": r.address, "city": r.city.title(),
            "acres": None if pd.isna(r.acres) else round(float(r.acres), 2), "zoning": r.zoning,
            "use": r.use or "Use not listed", "vacant": "vacant" in r.use.lower(), "due": r.due,
            "link": r.link if r.link.startswith("http") else "",
        },
    } for r in pd.DataFrame({
        "lat": d.lat, "lon": d.lon, "status": d["NOA Status"], "agency": d["Local Agency"],
        "address": d.Address, "city": d.City, "acres": acres, "zoning": d["General Plan/Zoning"],
        "use": use, "due": d["NOA Due Date"], "link": d["Notice Website Link"],
    }).itertuples()]


def load_county_names():
    """{county FIPS (3 digits): name}. CA county FIPS codes are odd numbers in alphabetical order."""
    return {f"{2 * i + 1:03d}": name.replace("_", " ") for i, name in enumerate(CA_COUNTIES)}


def nearest_km(tlat, tlon, flat, flon):
    """Haversine distance from each tract centroid to the nearest facility (chunked)."""
    R = 6371.0
    tl, tg = np.radians(tlat)[:, None], np.radians(tlon)[:, None]
    fl, fg = np.radians(flat)[None, :], np.radians(flon)[None, :]
    best = np.empty(len(tlat))
    for i in range(0, len(tlat), 1000):
        s = slice(i, i + 1000)
        a = np.sin((fl - tl[s]) / 2) ** 2 + np.cos(tl[s]) * np.cos(fl) * np.sin((fg - tg[s]) / 2) ** 2
        best[s] = (2 * R * np.arcsin(np.sqrt(a))).min(axis=1)
    return best


def tract_shapes():
    """Shapefile -> simplified GeoJSON with mapshaper; returns {GEOID: geometry}."""
    tmp = RAW / "tracts_simplified.geojson"
    if not tmp.exists():
        subprocess.run([
            "npx", "--yes", "mapshaper@0.6.102", str(RAW / "tracts_shp" / "cb_2023_06_tract_500k.shp"),
            "-filter-fields", "GEOID", "-simplify", "8%", "keep-shapes",
            "-o", "format=geojson", "precision=0.0001", str(tmp),
        ], check=True)
    return {f["properties"]["GEOID"]: f["geometry"] for f in json.loads(tmp.read_text())["features"]}


def main():
    t = load_tracts()
    fac = pd.concat([health_centers(), family_planning(), hospitals(), mammography()], ignore_index=True)
    fac = fac.dropna(subset=["lat", "lon"])
    fac = fac[fac.lat.between(32, 42.1) & fac.lon.between(-124.6, -114)]  # California bounds

    dist_cols = {"health_center": "km_health_center", "family_planning": "km_family_planning",
                 "birthing_hospital": "km_birthing_hospital", "mammography": "km_mammography"}
    for kind, col in dist_cols.items():
        f = fac[fac.type == kind]
        t[col] = nearest_km(t.lat.values, t.lon.values, f.lat.values, f.lon.values).round(1)

    # County has no hospital delivering babies (our own measure from HCAI data, not March of Dimes).
    county_names = load_county_names()
    fips_by_name = {v.lower(): k for k, v in county_names.items()}
    births = fac[fac.type == "birthing_hospital"]
    counties_with_births = {fips_by_name.get(str(c).lower()) for c in births.county}
    t["county_no_birthing"] = (~t.county_fips.isin(counties_with_births)).astype(int)

    t["mammo_gap"] = (t.mammo_pct.mean() - t.mammo_pct).round(1)
    rankable = (t.women_total >= MIN_WOMEN) & t.mammo_pct.notna()
    t["rankable"] = rankable.astype(int)

    # Percentile ranks among rankable tracts; higher = more need / farther from care.
    pct_inputs = {
        "p_women": "women_total", "p_poverty": "poverty_pct", "p_uninsured": "uninsured_pct",
        "p_transport": "no_transport_pct", "p_mammo_gap": "mammo_gap",
        "p_far_hc": "km_health_center", "p_far_fp": "km_family_planning",
        "p_far_birth": "km_birthing_hospital", "p_far_mammo": "km_mammography",
    }
    for p, col in pct_inputs.items():
        t[p] = t[col].where(rankable).rank(pct=True).round(3)

    shapes = tract_shapes()
    keep = ["GEOID", "county_fips", "zcta", "pop_total", "women_total", "women_15_44", "women_45_64", "poverty_pct",
            "uninsured_pct", "no_transport_pct", "mammo_pct", "checkup_pct", "limited_english_pct",
            "housing_insecure_pct", "diabetes_pct", "bphigh_pct", "depression_pct", "obesity_pct",
            "food_insecure_pct", "under100_pct", "under200_pct", *dist_cols.values(),
            "county_no_birthing", "rankable", "lat", "lon", *pct_inputs]
    features = []
    for row in t[keep].to_dict("records"):
        geom = shapes.get(row["GEOID"])
        if geom is None:
            continue
        props = {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in row.items()}
        props["lat"], props["lon"] = round(props["lat"], 4), round(props["lon"], 4)
        features.append({"type": "Feature", "geometry": geom, "properties": props})
    (OUT / "tracts.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features},
                                                  separators=(",", ":")))

    fac_features = [{
        "type": "Feature", "geometry": {"type": "Point", "coordinates": [round(r.lon, 5), round(r.lat, 5)]},
        "properties": {"type": r.type, "name": r.name, "address": r.address, "city": r.city, "detail": r.detail,
                       **({"org": r.org, "phone": r.phone} if r.type == "health_center" else {})},
    } for r in fac.itertuples()]
    (OUT / "facilities.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": fac_features},
                                                      separators=(",", ":")))

    (OUT / "hospitals.json").write_text(json.dumps(partner_hospitals(), separators=(",", ":"), allow_nan=False))

    land = surplus_land()
    (OUT / "land.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": land},
                                                separators=(",", ":"), allow_nan=False))

    meta = {
        "land_counts": {s: sum(f["properties"]["status"] == s for f in land) for s in ("open", "recent")},
        "state_avg": {c: round(float(t.loc[rankable, c].mean()), 1) for c in
                      ["mammo_pct", "uninsured_pct", "no_transport_pct", "poverty_pct", "checkup_pct",
                       "limited_english_pct", "housing_insecure_pct", "diabetes_pct", "bphigh_pct",
                       "depression_pct", "obesity_pct", "food_insecure_pct", "under100_pct", "under200_pct"]},
        "state_median_km": {c: round(float(t.loc[rankable, c].median()), 1) for c in dist_cols.values()},
        "counties": county_names,
        "counts": fac.type.value_counts().to_dict(),
        "tracts": int(len(features)), "rankable_tracts": int(rankable.sum()),
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))

    print(f"tracts: {len(features)} ({int(rankable.sum())} rankable)")
    print("facilities:", meta["counts"])
    print("state averages:", meta["state_avg"])
    print("median km to nearest:", meta["state_median_km"])
    print(f"counties without a delivering hospital: {t[t.county_no_birthing == 1].county_fips.nunique()}")
    for f in OUT.iterdir():
        print(f"  {f.name}: {f.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
