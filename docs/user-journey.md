# HerSite user journey: Maria adds a women's health site

## Persona
**Maria** is a fictional composite: program director at an existing California community health center (CHC). She wants to open one new site for everyday women's care: prenatal and postpartum care, birth control, Pap/HPV screening, STI testing and well-woman visits. Births and mammograms are referred out.

## Which path
- **Path A, the one we design for:** an existing health center **adds a site** to its HRSA "scope of project." The site goes on **Form 5B: Service Sites**. It is funded either by a **New Access Point (NAP)** grant or with existing money through a **change-in-scope request**. Either way, HRSA must approve it in advance (ch. 6, footnote 2; ch. 14, footnote 1).
- **Path B, out of scope:** a brand-new organization. It must first prove eligibility as a non-profit, public agency or tribal organization (ch. 1). Look-alikes must already deliver primary care in the area and not be controlled by another organization. Chapter 1 is an entry gate and doesn't affect where to open.

## The journey

Status key: **MVP** = in the hackathon prototype · **Next** = planned platform update · **Out** = outside HerSite's scope

| # | Stage | What HRSA requires | Maria's pain | How HerSite supports it | Status |
|---|---|---|---|---|---|
| 1 | **Make the early case** | The board approves applications and site locations, hours and services (ch. 19) | She needs a persuasive case before investing staff time | Ranked map with a plain-language reason per tract; shareable view | MVP |
| 2 | **Confirm the path** | Eligibility (ch. 1); NAP or change in scope; prior approval for a new site (ch. 6) | Paperwork and rules, not data | A short "which path?" explainer that links to HRSA pages | Out (link only) |
| 3 | **Define the service area** | ZIP codes on Form 5B covering ≥75% of patients (per UDS); boundaries follow political, school and program lines and reduce barriers like transportation; reviewed every year (ch. 3) | She builds ZIP lists by hand | Tract-to-ZIP crosswalk; select tracts and export the ZIP list; optional upload of her UDS patient ZIPs to check the 75% rule | Next |
| 4 | **Assess unmet need** | At least every 3 years, using the most recent data: provider-to-population ratios (incl. OB/GYN), infant mortality, poverty, demographics, access factors (geography, transportation, income, education), leading causes of illness, language, housing (ch. 3) | The slowest part, often outsourced | **MVP layers:** women by age, uninsured, transportation, mammogram screening, distance to women's care. **Next:** OB/GYN ratio, low birth weight and infant mortality, language, housing insecurity. **Export:** a needs table with sources and dates | MVP + Next |
| 5 | **Pick an accessible location** | Sites accessible to where patients live or work; consider access barriers and travel distance and time; hours fit patient needs (ch. 6). Mobile sites are allowed | She has to justify the exact spot | Ranked tracts with reasons; adjustable weights; suggests a mobile unit for sparse tracts | MVP (straight-line distance); Next (drive time) |
| 6 | **Find space** | The new site must be listed on Form 5B (ch. 6) | No single list of available buildings | Surplus public property, where a bulk list exists, plus her own pins | Next (no commercial listings: no open data) |
| 7 | **Collaborate and collect letters** | When expanding scope, get letters from nearby health centers, rural health clinics, local and critical access hospitals, health departments and specialists, or document her attempts (ch. 14). Set up referrals for services she doesn't provide | Working out who to ask, then chasing them | "Partners within X km" list from existing layers (health centers, family planning clinics, birthing hospitals, mammography sites) with addresses and phone numbers; CSV export to track outreach | Next |
| 8 | **Plan services and staffing** | Required services, staffing, after-hours coverage, hospital admitting, sliding fee scale (ch. 4–9) | Operational planning | Show which women's services nearby providers already offer, to avoid duplicating them | Out (that one view could be Next) |
| 9 | **Budget, board approval, submit** | Budget and financial systems (ch. 15–17); board approves the application and site (ch. 19) | The application crunch | Export pack: map image, ranked reasons, needs table and partner list | Next (export only) |
| 10 | **Keep it current** | Review the service area every year, update the needs assessment every 3 years, report UDS every year (ch. 3, 18) | Redoing the work every cycle | Saved project that refreshes with new data releases and highlights what changed | Later |

## What to build, in order
1. **MVP (demo):** stages 1, 4 and 5. Ranked tracts, the reason panel, weight sliders and the core need layers.
2. **Next (highest value, low cost):**
   - **ZIP export (stage 3):** HUD's free tract-to-ZIP crosswalk.
   - **Partner list (stage 7):** reuses facility layers we already have, which include phone numbers.
   - **Extra need layers (stage 4):**
     - Housing insecurity (`HOUSINSECU`) is already in CDC PLACES.
     - Language comes from Census ACS.
     - The OB/GYN ratio comes from the free NPPES provider registry (taxonomy codes).
     - Birth outcomes come from CDPH county birth data.
   - **Export pack (stages 1 and 9).**
3. **Later:** drive time (OSRM), saved projects, UDS patient-ZIP upload, a candidate-space layer.

## Pitch line
"HRSA tells Maria *what* to prove. HerSite gives her the evidence, the ZIP list and the partner list she needs to prove it."

## Sources
HRSA Health Center Program Compliance Manual:
- **Read for this doc:** ch. 1 (eligibility), ch. 3 (needs assessment), ch. 6 (accessible locations), ch. 14 (collaborative relationships), ch. 19 (board authority), checked November 2026.
- **Not verified line by line here:** ch. 4–9, 15–18.

Also used: the HRSA NAP FAQ (Unmet Need Score worth up to 20 points) and COPE Health Solutions (about 2 months to apply).
