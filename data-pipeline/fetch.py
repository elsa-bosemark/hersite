"""Download every public source HerSite uses into data-pipeline/raw/.

All sources are public, aggregated, or facility-level. No patient data.
Run: .venv/bin/python data-pipeline/fetch.py
"""
import io
import json
import zipfile
from pathlib import Path

import pandas as pd
import requests

RAW = Path(__file__).parent / "raw"
RAW.mkdir(exist_ok=True)

SOURCES = {
    # 2020 census tracts (used by ACS 2023 and CDC PLACES)
    "tracts_shp.zip": "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_06_tract_500k.zip",
    "gaz_tracts.txt": "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_gaz_tracts_06.txt",
    # HRSA health center service delivery sites (has coordinates)
    "hrsa_sites.csv": "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv",
    # California Family PACT (family planning) enrolled providers, 2026 Q1
    "fpact.csv": "https://data.chhs.ca.gov/dataset/ab5493cd-b041-4d5b-9ec9-d1dd4f641190/resource/17914a27-ff71-43fd-9c44-d7a4251db844/download/family-pact-enrolled-providers-quarterly-update-2026-q1.csv",
    # HCAI hospital annual utilization: births per hospital, 2025 and 2021 (to detect L&D closures)
    "hcai_util_2025.xlsx": "https://data.chhs.ca.gov/dataset/1902083c-f16a-434d-b8ac-f7a573a305df/resource/355051b2-a10c-4429-9da6-69edc65b7834/download/hosp25_util_data_final.xlsx",
    "hcai_util_2021.xlsx": "https://data.chhs.ca.gov/dataset/1902083c-f16a-434d-b8ac-f7a573a305df/resource/e2ef5e5a-1dbc-4b67-894f-5bad34b79798/download/hosp21_util_data_final-revised-06.15.2023.xlsx",
    # FDA MQSA certified mammography facilities (addresses only)
    "fda_mqsa.zip": "https://www.accessdata.fda.gov/premarket/ftparea/public.zip",
    # Census 2020 ZIP code tabulation area (ZCTA) to tract relationship file, national
    "zcta_tract_rel.txt": "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_tract20_natl.txt",
    # HCD Surplus Land Act notices: public land and buildings local agencies have offered (has coordinates)
    "sla_notices.csv": "https://publish.data.ca.gov/dataset/0a52a6d9-4c1f-4905-8d25-6117c60c35c8/resource/bb81599a-e130-48aa-a6e3-bbcce9392d4f/download/noa_information.csv",
}

ACS_YEAR = 2023
# B01001: sex by age. Female 15-44 = 030..038, female 45-64 = 039..043.
FEMALE_15_44 = [f"B01001_{i:03d}E" for i in range(30, 39)]
FEMALE_45_64 = [f"B01001_{i:03d}E" for i in range(39, 44)]
# C16002: limited-English-speaking households = 004 + 007 + 010 + 013 (Spanish, other Indo-European, Asian, other)
LIMITED_ENGLISH = ["C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E"]
# C17002: ratio of income to poverty. 002+003 = under 100% of poverty; 002..007 = under 200%.
UNDER_100 = ["C17002_002E", "C17002_003E"]
UNDER_200 = [f"C17002_{i:03d}E" for i in range(2, 8)]
ACS_VARS = ["B01001_001E", "B01001_026E", *FEMALE_15_44, *FEMALE_45_64, "B17001_001E", "B17001_002E",
            "C16002_001E", *LIMITED_ENGLISH, "C17002_001E", *UNDER_200]

PLACES_MEASURES = ["MAMMOUSE", "ACCESS2", "LACKTRPT", "CHECKUP",
                   "HOUSINSECU", "DIABETES", "BPHIGH", "DEPRESSION", "OBESITY", "FOODINSECU"]


def download(name, url):
    path = RAW / name
    if path.exists():
        print(f"  cached  {name}")
        return path
    print(f"  fetch   {name}")
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    path.write_bytes(r.content)
    return path


def acs_table(table):
    """Stream a national ACS table-based summary file (no API key needed); keep CA tracts only."""
    url = (f"https://www2.census.gov/programs-surveys/acs/summary_file/{ACS_YEAR}/table-based-SF/"
           f"data/5YRData/acsdt5y{ACS_YEAR}-{table}.dat")
    lines = []
    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        for i, line in enumerate(r.iter_lines()):
            if i == 0 or line.startswith(b"1400000US06"):
                lines.append(line.decode("latin-1"))
    df = pd.read_csv(io.StringIO("\n".join(lines)), sep="|", dtype=str)
    df["GEOID"] = df.GEO_ID.str[-11:]
    return df.set_index("GEOID")


def fetch_acs():
    path = RAW / "acs.csv"
    if path.exists():
        print("  cached  acs.csv")
        return
    print("  fetch   acs.csv (streams ~320 MB of national files)")
    df = acs_table("b01001").join(acs_table("b17001").drop(columns="GEO_ID")).join(acs_table("c16002").drop(columns="GEO_ID")).join(acs_table("c17002").drop(columns="GEO_ID"))
    # Summary files name estimates "B01001_E026"; rename to API-style "B01001_026E".
    df = df.rename(columns=lambda c: f"{c[:6]}_{c[8:]}E" if c[7:8] == "E" else c).reset_index()
    for v in ACS_VARS:
        df[v] = pd.to_numeric(df[v], errors="coerce").clip(lower=0)
    out = pd.DataFrame({
        "GEOID": df.GEOID,
        "pop_total": df.B01001_001E,
        "women_total": df.B01001_026E,
        "women_15_44": df[FEMALE_15_44].sum(axis=1),
        "women_45_64": df[FEMALE_45_64].sum(axis=1),
        "poverty_pct": (df.B17001_002E / df.B17001_001E.where(df.B17001_001E > 0) * 100).round(1),
        "limited_english_pct": (df[LIMITED_ENGLISH].sum(axis=1) / df.C16002_001E.where(df.C16002_001E > 0) * 100).round(1),
        "under100_pct": (df[UNDER_100].sum(axis=1) / df.C17002_001E.where(df.C17002_001E > 0) * 100).round(1),
        "under200_pct": (df[UNDER_200].sum(axis=1) / df.C17002_001E.where(df.C17002_001E > 0) * 100).round(1),
    })
    out.to_csv(path, index=False)


def fetch_places():
    path = RAW / "places.csv"
    if path.exists():
        print("  cached  places.csv")
        return
    print("  fetch   places.csv")
    ids = ",".join(f"'{m}'" for m in PLACES_MEASURES)
    r = requests.get(
        "https://data.cdc.gov/resource/cwsq-ngmh.csv",
        params={
            "$select": "locationname,measureid,data_value",
            "$where": f"stateabbr='CA' AND measureid in ({ids})",
            "$limit": 100000,
        },
        timeout=300,
    )
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text), dtype={"locationname": str})
    wide = df.pivot_table(index="locationname", columns="measureid", values="data_value").reset_index()
    wide = wide.rename(columns={"locationname": "GEOID"})
    wide.to_csv(path, index=False)


def geocode_mammography():
    """Census batch geocoder (free, no key) for CA mammography facility addresses."""
    path = RAW / "mammography_geocoded.csv"
    if path.exists():
        print("  cached  mammography_geocoded.csv")
        return
    print("  geocode mammography_geocoded.csv")
    with zipfile.ZipFile(RAW / "fda_mqsa.zip") as z:
        text = z.read(z.namelist()[0]).decode("latin-1")
    cols = ["name", "addr1", "addr2", "addr3", "city", "state", "zip", "phone", "fax"]
    df = pd.read_csv(io.StringIO(text), sep="|", names=cols, dtype=str).fillna("")
    df = df[df.state == "CA"].reset_index(drop=True)
    df["id"] = df.index.astype(str)
    batch = df[["id", "addr1", "city", "state", "zip"]].copy()
    batch["zip"] = batch.zip.str[:5]
    buf = io.StringIO()
    batch.to_csv(buf, index=False, header=False)
    r = requests.post(
        "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
        files={"addressFile": ("addresses.csv", buf.getvalue())},
        data={"benchmark": "Public_AR_Current"},
        timeout=600,
    )
    r.raise_for_status()
    res = pd.read_csv(io.StringIO(r.text), header=None, dtype=str,
                      names=["id", "input", "match", "exact", "matched", "coords", "tiger", "side"])
    res = res[res.match == "Match"].copy()
    res[["lon", "lat"]] = res.coords.str.split(",", expand=True).astype(float)
    out = df.merge(res[["id", "lon", "lat"]], on="id")
    print(f"          matched {len(out)} of {len(df)} CA facilities")
    out[["name", "addr1", "city", "zip", "phone", "lat", "lon"]].to_csv(path, index=False)


def unzip_tracts():
    dest = RAW / "tracts_shp"
    if dest.exists():
        return
    with zipfile.ZipFile(RAW / "tracts_shp.zip") as z:
        z.extractall(dest)


if __name__ == "__main__":
    print("Downloading sources")
    for name, url in SOURCES.items():
        download(name, url)
    unzip_tracts()
    fetch_acs()
    fetch_places()
    geocode_mammography()
    print("Done. Next: build.py")
