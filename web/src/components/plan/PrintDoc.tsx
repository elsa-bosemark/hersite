import { useEffect } from 'react'
import PlanDocument from './PlanDocument'
import type { PrintSection, StepProps } from './types'
import type { ProgramId } from '../../lib/programs'

/** The application document over the app, ready to print; the browser's print dialog saves it as PDF. */
export default function PrintDoc(p: StepProps & { sections: PrintSection[]; programId?: ProgramId; onClose: () => void }) {
  const { onClose } = p
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="print-doc" role="dialog" aria-label="Printable site plan">
      <div className="print-bar no-print">
        <span>Preview. Use Print, then “Save as PDF”.</span>
        <span>
          <button className="btn on" onClick={() => window.print()}>Print</button>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </span>
      </div>
      <PlanDocument {...p} />
    </div>
  )
}
