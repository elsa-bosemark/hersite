# HerSite

**Plan where to open women's care, and gather the evidence funders ask for.**

HerSite helps women's health clinics and community health centers in California decide where to open a new site,
then builds the evidence their application needs: for **Title X** family planning, **HRSA's Health Center Program**,
and **CalRHT** rural health grants. Fill the plan in once; download a version labeled for each funder.

## What it does

- **Find the place.** Search a town, ZIP code or county, or explore a statewide map of about 9,000 census tracts
  ranked by need (low-income women, insurance, transportation, screening rates, distance to care).
- **Build the site plan,** a six-step wizard with the application filling in live beside it:
  1. **Service area:** ZIP codes, adjustable on the map.
  2. **Unmet need:** auto-filled and grouped by the factors funders name, compared with the county and the state, with sources.
  3. **Site & access:** site pin, hours, estimated clients, distance from each ZIP, and a coverage map.
  4. **Space:** public land offered under California's Surplus Land Act, listing searches, and your own candidate spaces.
  5. **Partners:** nearby health centers, hospitals, mammography sites and the health department, with a
     letter-of-commitment request and status tracking.
  6. **Report:** preview each funder's version, or download all three as PDFs in one ZIP.

Plans are saved in the browser. There is no sign-up and no patient data.

## Run it

```bash
cd web && npm install && npm run dev
```

The processed data is already in `web/public/data/`. To rebuild it from the original public sources:

```bash
python3 -m venv .venv && .venv/bin/pip install pandas numpy requests openpyxl
.venv/bin/python data-pipeline/fetch.py   # downloads into data-pipeline/raw/ (no API keys)
.venv/bin/python data-pipeline/build.py   # writes web/public/data/ (needs Node for `npx mapshaper`)
```

## Data

| Layer | Source |
|---|---|
| Population, women by age, poverty, low income, limited English | Census ACS 5-year 2019–2023, table-based summary files |
| Uninsured, transportation, screening, food and housing insecurity, chronic disease | CDC PLACES tract estimates |
| Each tract's ZIP code | Census 2020 ZCTA-to-tract relationship file |
| Community health centers | HRSA Health Center Service Delivery Sites |
| Family planning | CA DHCS Family PACT enrolled providers (2026 Q1) |
| Hospitals, labor & delivery, closures | CA HCAI Hospital Annual Utilization, 2021 and 2025 |
| Mammography | FDA MQSA certified facilities, geocoded with the Census batch geocoder |
| Public land & buildings for sale | CA HCD Surplus Land Act notices (open now, or offered since 2024) |

## Known limits

- Distances are straight-line from each tract's center, not drive time.
- PLACES values are modeled estimates. "Low-income women 15–44" is an estimate (women 15–44 × the tract's share under 200% of poverty).
- Surplus Land Act parcels go first to affordable housing, parks and schools; a past notice doesn't mean a parcel is still available.
- HerSite prepares supporting evidence. Applications are still submitted through each funder's own system,
  and parts of each application (for example Title X's program-priority sections, budgets and staffing) are up to you.
- No price layer yet.
