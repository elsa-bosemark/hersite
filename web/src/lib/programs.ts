/**
 * The funding programs a site plan can be built for. The evidence is the same (area, need, access,
 * space, partners); what changes is each funder's vocabulary and where it asks for it.
 */
export type ProgramId = 'titlex' | 'hrsa' | 'calrht'

export interface Program {
  id: ProgramId
  name: string
  short: string
  who: string
  funder: string
  /** The "care you'll offer" option that fits this program best. */
  care: string
  /** Where the funder asks for each step, in step order (area, need, access, space, partners, report). */
  refs: [string, string, string, string, string, string]
  partners: { title: string; lede: string; ask: string; letter: 'commitment' | 'support' }
  notes: string
  link: string
  /** False while a funder's version is still being built; its tab shows "Coming soon". */
  available: boolean
  /** "Learn more" text and links shown under the version title. */
  learn: { summary: string; how: string; links: [string, string][] }
}

export const PROGRAMS: Record<ProgramId, Program> = {
  titlex: {
    id: 'titlex',
    name: 'Title X family planning',
    short: 'Title X',
    who: 'Women\'s health and family planning clinics',
    funder: 'HHS Office of Population Affairs. In California, new sites join through Essential Access Health, the state\'s Title X grantee.',
    care: 'Birth control & family planning',
    refs: [
      'Title X: proposed service area',
      'Title X: need, especially low-income (25 of 100 points)',
      'Title X: each site vs. need, days and hours',
      'Title X: facilities',
      'Title X: letters of commitment',
      'Title X: coverage map + narrative',
    ],
    partners: {
      title: 'Referral partners',
      lede: 'Title X accepts letters of commitment from referral partners, describing their specific role. General letters of support are not considered.',
      ask: 'Copy commitment request',
      letter: 'commitment',
    },
    notes: 'Applications for the FY2027 notice (PA-FPH-27-001) are due January 9, 2027. Check Essential Access Health for California subrecipient openings.',
    link: 'https://opa.hhs.gov/grant-programs/title-x-service-grants',
    available: false,
    learn: { summary: '', how: '', links: [] },
  },
  hrsa: {
    id: 'hrsa',
    name: 'HRSA Health Center Program',
    short: 'HRSA',
    who: 'Community health centers adding a site',
    funder: 'HRSA Bureau of Primary Health Care, through a New Access Point grant or a change in scope.',
    care: "All women's care",
    refs: [
      'HRSA ch. 3 · Form 5B',
      'HRSA ch. 3',
      'HRSA ch. 6',
      'HRSA Form 5B',
      'HRSA ch. 14',
      'HRSA application evidence',
    ],
    partners: {
      title: 'Partners & letters',
      lede: 'HRSA wants letters from local health centers, hospitals and the health department, or a record that you asked.',
      ask: 'Copy letter request',
      letter: 'support',
    },
    notes: 'Applications are filed through Grants.gov and HRSA\'s EHBs. HerSite prepares the supporting evidence.',
    link: 'https://bphc.hrsa.gov/compliance/compliance-manual',
    available: true,
    learn: {
      summary: 'HRSA\'s Health Center Program funds community health centers that provide primary care, including prenatal care, family planning and cancer screening, to everyone in their area regardless of ability to pay.',
      how: 'An existing health center adds a site through a New Access Point grant or a change-in-scope request. HRSA reviews the service area (Form 5B), the needs assessment (Compliance Manual ch. 3), the site\'s accessibility and hours (ch. 6) and your collaboration with local providers (ch. 14). Applications are submitted through Grants.gov and HRSA\'s EHBs; this document is the supporting evidence.',
      links: [
        ['Health Center Program Compliance Manual', 'https://bphc.hrsa.gov/compliance/compliance-manual'],
        ['Scope of project and Form 5B', 'https://bphc.hrsa.gov/compliance/scope-project'],
        ['Health Center Program funding', 'https://bphc.hrsa.gov/funding'],
      ],
    },
  },
  calrht: {
    id: 'calrht',
    name: 'CalRHT rural health grants',
    short: 'CalRHT',
    who: 'Rural clinics, hospitals and health centers',
    funder: 'California HCAI\'s Rural Health Transformation program (federal CMS funds).',
    care: 'Prenatal & postpartum',
    refs: [
      'CalRHT: rural service area',
      'CalRHT: community need',
      'CalRHT: access in rural areas',
      'CalRHT: project site',
      'CalRHT: partners',
      'CalRHT proposal evidence',
    ],
    partners: {
      title: 'Partners',
      lede: 'Rural health grants favor partnerships. Track who you\'ve asked to join or support the project.',
      ask: 'Copy partner request',
      letter: 'support',
    },
    notes: 'The first round\'s awards (about $166.7M) are tentative. Check HCAI for the next funding opportunity and its exact requirements.',
    link: 'https://hcai.ca.gov/rural-health/calrht/',
    available: false,
    learn: { summary: '', how: '', links: [] },
  },
}

export const PROGRAM_ORDER: ProgramId[] = ['hrsa', 'titlex', 'calrht']
export const DEFAULT_PROGRAM: ProgramId = 'hrsa'
/** The program a plan's document shows; falls back to HRSA while the others are coming soon. */
export const programOf = (id: ProgramId | undefined) => {
  const p = PROGRAMS[id ?? DEFAULT_PROGRAM]
  return p.available ? p : PROGRAMS[DEFAULT_PROGRAM]
}
