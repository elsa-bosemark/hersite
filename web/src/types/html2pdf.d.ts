declare module 'html2pdf.js' {
  interface Html2PdfWorker {
    set(options: Record<string, unknown>): Html2PdfWorker
    from(element: HTMLElement): Html2PdfWorker
    outputPdf(type: 'blob'): Promise<Blob>
  }
  export default function html2pdf(): Html2PdfWorker
}
