import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import JSZip from 'jszip'
import html2pdf from 'html2pdf.js'
import PlanDocument from '../components/plan/PlanDocument'
import type { StepProps } from '../components/plan/types'
import { PROGRAMS, PROGRAM_ORDER } from './programs'

const ALL = ['area', 'need', 'access', 'space', 'partners'] as const
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim()

/**
 * Render the plan once per funding program, turn each into a PDF, and download them together as a ZIP.
 * Each version is rendered off screen with the same component as the preview, so the files match what's shown.
 */
export async function downloadAllVersions(p: StepProps, onProgress?: (msg: string) => void) {
  const zip = new JSZip()
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;background:#fff'
  document.body.appendChild(host)
  try {
    for (const id of PROGRAM_ORDER) {
      onProgress?.(`Making the ${PROGRAMS[id].short} version…`)
      const mount = document.createElement('div')
      host.appendChild(mount)
      const root = createRoot(mount)
      root.render(createElement(PlanDocument, { ...p, sections: [...ALL], programId: id }))
      await new Promise((r) => setTimeout(r, 300))
      const page = mount.querySelector<HTMLElement>('.print-page') ?? mount
      const blob = await html2pdf().set({
        margin: [12, 12, 14, 12],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.doc-head', 'img'] },
      }).from(page).outputPdf('blob')
      zip.file(`${safe(p.plan.name)} - ${PROGRAMS[id].short} application evidence.pdf`, blob)
      root.unmount()
      mount.remove()
    }
    onProgress?.('Zipping…')
    const out = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(out)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safe(p.plan.name)} - application evidence (Title X, HRSA, CalRHT).zip`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    host.remove()
  }
}

