import { jsPDF } from 'jspdf'
import { formatMoney, formatSunday, type SalesDraft } from './sales'

export function downloadSalesSummaryPdf(summary: SalesDraft, cashier: string, isSaved = false) {
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const contentWidth = 132
  const contentX = (pageWidth - contentWidth) / 2
  const contentRight = contentX + contentWidth
  const worked = summary.mtn_amount + summary.airtel_amount + summary.cash_deposited
  const cashAtHand = Math.max(0, summary.cash_deposited - summary.expenses)
  const shortfall = Math.max(0, summary.expenses - summary.cash_deposited)
  const generated = new Intl.DateTimeFormat('en-UG', {
    timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date())

  // Simple green masthead, retaining the original report's calm visual style.
  pdf.setFillColor(23, 107, 74)
  pdf.rect(0, 0, pageWidth, 44, 'F')
  pdf.setFillColor(35, 143, 99)
  pdf.rect(0, 42, pageWidth, 2, 'F')
  pdf.setTextColor(218, 239, 226)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text('SUNDAY CLOSE', contentX, 14)
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(22)
  pdf.text('Sales summary', contentX, 27)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(235, 247, 239)
  pdf.text(formatSunday(summary.sunday_date), contentX, 36)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(221, 243, 230)
  pdf.text(isSaved ? 'SAVED RECORD' : 'DRAFT PREVIEW', contentRight, 14, { align: 'right' })

  // Recorder and date sit together in a quiet metadata band.
  const metaY = 55
  pdf.setFillColor(247, 250, 248)
  pdf.roundedRect(contentX, metaY, contentWidth, 20, 2, 2, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(111, 127, 116)
  pdf.text('RECORDED BY', contentX + 6, metaY + 7)
  pdf.text('SUNDAY DATE', contentX + contentWidth * 0.56, metaY + 7)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(32, 48, 38)
  const cashierLines = pdf.splitTextToSize(cashier, contentWidth * 0.45)
  pdf.text(cashierLines.slice(0, 1), contentX + 6, metaY + 14)
  pdf.text(formatSunday(summary.sunday_date), contentX + contentWidth * 0.56, metaY + 14)

  // Itemized figures with ample spacing and a light rule for each line.
  const rows: [string, string][] = [
    ['IDs printed', summary.ids_printed.toLocaleString('en-UG')],
    ['MTN Mobile Money', formatMoney(summary.mtn_amount)],
    ['Airtel Money', formatMoney(summary.airtel_amount)],
    ['Cash deposited', formatMoney(summary.cash_deposited)],
    ['Total expenses', formatMoney(summary.expenses)],
  ]
  let y = 91
  rows.forEach(([label, value], index) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10.5)
    pdf.setTextColor(91, 108, 97)
    pdf.text(label, contentX + 2, y)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(39, 52, 43)
    pdf.text(value, contentRight - 2, y, { align: 'right' })
    pdf.setDrawColor(228, 234, 229)
    pdf.setLineWidth(0.25)
    pdf.line(contentX, y + 7, contentRight, y + 7)
    y += index === 0 ? 17 : 18
  })

  // The closing totals are the visual focal point of the page.
  const totalsY = y + 1
  pdf.setFillColor(234, 244, 238)
  pdf.roundedRect(contentX, totalsY, contentWidth, 40, 3, 3, 'F')
  pdf.setFillColor(23, 107, 74)
  pdf.roundedRect(contentX, totalsY, 2, 40, 1, 1, 'F')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(80, 101, 87)
  pdf.text('Total amount worked', contentX + 8, totalsY + 14)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(23, 107, 74)
  pdf.text(formatMoney(worked), contentRight - 8, totalsY + 15, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(80, 101, 87)
  pdf.text('Cash at hand', contentX + 8, totalsY + 31)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(39, 52, 43)
  pdf.text(formatMoney(cashAtHand), contentRight - 8, totalsY + 31, { align: 'right' })

  if (shortfall > 0) {
    const alertY = totalsY + 48
    pdf.setFillColor(255, 247, 237)
    pdf.roundedRect(contentX, alertY, contentWidth, 12, 2, 2, 'F')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(150, 75, 35)
    pdf.text(`Expenses exceed cash deposited by ${formatMoney(shortfall)}.`, contentX + 5, alertY + 7.5)
  }

  pdf.setDrawColor(226, 232, 227)
  pdf.line(contentX, 278, contentRight, 278)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(130, 142, 133)
  pdf.text('Sunday Close  ·  Internal sales record', contentX, 284)
  pdf.text(`Generated ${generated} EAT`, contentRight, 284, { align: 'right' })

  const blobUrl = URL.createObjectURL(pdf.output('blob'))
  const downloadLink = document.createElement('a')
  downloadLink.href = blobUrl
  downloadLink.download = `sunday-sales-${summary.sunday_date}.pdf`
  downloadLink.style.display = 'none'
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}
