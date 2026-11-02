import { jsPDF } from 'jspdf'
import { formatMoney, formatSunday, type SalesDraft } from './sales'

export function downloadSalesSummaryPdf(summary: SalesDraft, cashier: string) {
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 18
  const worked = summary.mtn_amount + summary.airtel_amount + summary.cash_deposited
  const cashAtHand = Math.max(0, summary.cash_deposited - summary.expenses)
  const shortfall = Math.max(0, summary.expenses - summary.cash_deposited)

  pdf.setFillColor(23, 107, 74)
  pdf.rect(0, 0, pageWidth, 42, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('SUNDAY CLOSE', margin, 17)
  pdf.setFontSize(21)
  pdf.text('Sales summary', margin, 29)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(formatSunday(summary.sunday_date), margin, 36)

  let y = 57
  pdf.setTextColor(110, 122, 113)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('RECORDED BY', margin, y)
  pdf.setTextColor(32, 41, 35)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(cashier, margin, y + 7)
  y += 22

  const rows: [string, string][] = [
    ['IDs printed', summary.ids_printed.toLocaleString('en-UG')],
    ['MTN Mobile Money', formatMoney(summary.mtn_amount)],
    ['Airtel Money', formatMoney(summary.airtel_amount)],
    ['Cash deposited', formatMoney(summary.cash_deposited)],
    ['Total expenses', formatMoney(summary.expenses)],
  ]

  for (const [label, amount] of rows) {
    pdf.setDrawColor(226, 231, 226)
    pdf.line(margin, y + 5, pageWidth - margin, y + 5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(101, 113, 104)
    pdf.text(label, margin, y)
    pdf.setTextColor(32, 41, 35)
    pdf.text(amount, pageWidth - margin, y, { align: 'right' })
    y += 14
  }

  y += 3
  pdf.setFillColor(234, 244, 238)
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 35, 3, 3, 'F')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(89, 103, 93)
  pdf.text('Total amount worked', margin + 6, y + 11)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.setTextColor(23, 107, 74)
  pdf.text(formatMoney(worked), pageWidth - margin - 6, y + 12, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(89, 103, 93)
  pdf.text('Cash at hand', margin + 6, y + 26)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(32, 41, 35)
  pdf.text(formatMoney(cashAtHand), pageWidth - margin - 6, y + 26, { align: 'right' })

  if (shortfall > 0) {
    y += 44
    pdf.setTextColor(164, 71, 48)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`Expenses exceed cash deposited by ${formatMoney(shortfall)}.`, margin, y)
  }

  const generated = new Intl.DateTimeFormat('en-UG', {
    timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date())
  pdf.setTextColor(130, 140, 132)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(`Generated ${generated}`, margin, 280)
  pdf.save(`sunday-sales-${summary.sunday_date}.pdf`)
}
