import { jsPDF } from 'jspdf'
import { formatMoney, type SalesDraft } from './sales'

type PdfRow = { cells: string[]; total?: boolean; expense?: boolean }

function drawTable(
  pdf: jsPDF,
  x: number,
  y: number,
  widths: number[],
  headings: string[],
  rows: PdfRow[],
) {
  const headerHeight = 11
  const rowHeight = 12
  const tableWidth = widths.reduce((total, width) => total + width, 0)

  pdf.setFillColor(15, 23, 42)
  pdf.rect(x, y, tableWidth, headerHeight, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6.2)
  pdf.setTextColor(255, 255, 255)
  let columnX = x
  headings.forEach((heading, index) => {
    const lines = pdf.splitTextToSize(heading, widths[index] - 5)
    pdf.text(lines, columnX + 2.5, y + (lines.length > 1 ? 4.2 : 6.8))
    columnX += widths[index]
  })

  let rowY = y + headerHeight
  rows.forEach((row, rowIndex) => {
    if (row.total) pdf.setFillColor(238, 244, 248)
    else if (rowIndex % 2 === 1) pdf.setFillColor(250, 251, 252)
    else pdf.setFillColor(255, 255, 255)
    pdf.rect(x, rowY, tableWidth, rowHeight, 'F')
    pdf.setDrawColor(214, 222, 230)
    pdf.setLineWidth(0.2)
    pdf.line(x, rowY + rowHeight, x + tableWidth, rowY + rowHeight)

    let textX = x
    row.cells.forEach((cell, index) => {
      pdf.setFont('helvetica', row.total || (row.expense && index === 0) ? 'bold' : 'normal')
      pdf.setFontSize(index === 0 ? 7.3 : 6.9)
      const isExpenseCategory = row.expense && index === 1
      pdf.setTextColor(
        isExpenseCategory ? 164 : row.total && index === 0 ? 15 : 73,
        isExpenseCategory ? 71 : row.total && index === 0 ? 23 : 86,
        isExpenseCategory ? 48 : row.total && index === 0 ? 42 : 98,
      )
      if (index === 0 || index === 1) {
        const lines = pdf.splitTextToSize(cell, widths[index] - 5)
        pdf.text(lines.slice(0, 2), textX + 2.5, rowY + (lines.length > 1 ? 4.2 : 7.5))
      } else {
        pdf.text(cell, textX + widths[index] - 2.5, rowY + 7.5, { align: 'right' })
      }
      textX += widths[index]
    })
    rowY += rowHeight
  })

  pdf.setDrawColor(214, 222, 230)
  pdf.rect(x, y, tableWidth, headerHeight + rows.length * rowHeight)
  let dividerX = x
  widths.slice(0, -1).forEach((width) => {
    dividerX += width
    pdf.line(dividerX, y, dividerX, rowY)
  })
}

export function downloadSalesSummaryPdf(summary: SalesDraft, cashier: string, isSaved = false) {
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  const worked = summary.mtn_amount + summary.airtel_amount + summary.cash_deposited
  const cashAtHand = Math.max(0, summary.cash_deposited - summary.expenses)
  const shortfall = Math.max(0, summary.expenses - summary.cash_deposited)
  const shares = (amount: number) => worked > 0 ? `${(amount / worked * 100).toFixed(1)}%` : '0.0%'
  const generated = new Intl.DateTimeFormat('en-UG', {
    timeZone: 'Africa/Kampala', dateStyle: 'short', timeStyle: 'short',
  }).format(new Date())

  // Dark report masthead with the date and export details.
  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, 0, pageWidth, 35, 'F')
  pdf.setFillColor(6, 182, 212)
  pdf.rect(0, 34, pageWidth, 1.4, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text('SUNDAY SALES', margin, 17)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(203, 213, 225)
  pdf.text(`SUNDAY: ${summary.sunday_date}`, margin, 25)
  pdf.setTextColor(34, 211, 238)
  pdf.text(`GENERATED: ${generated} EAT`, pageWidth - margin, 12, { align: 'right' })
  pdf.setTextColor(203, 213, 225)
  pdf.text('CURRENCY: UGX', pageWidth - margin, 19, { align: 'right' })
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6.5)
  pdf.text(isSaved ? 'SAVED RECORD' : 'DRAFT PREVIEW', pageWidth - margin, 27, { align: 'right' })

  // Four key figures, each with a restrained category color.
  const kpiY = 42
  const kpiGap = 3
  const kpiWidth = (contentWidth - kpiGap * 3) / 4
  const kpis = [
    { label: 'AMOUNT WORKED', value: formatMoney(worked), note: 'Gross receipts', color: [6, 182, 212] as const },
    { label: 'CASH AT HAND', value: formatMoney(cashAtHand), note: 'After expenses', color: [16, 185, 129] as const },
    { label: 'IDS PRINTED', value: summary.ids_printed.toLocaleString('en-UG'), note: 'Service volume', color: [168, 85, 247] as const },
    { label: 'EXPENSES', value: formatMoney(summary.expenses), note: 'Operational outflow', color: [239, 68, 68] as const },
  ]
  kpis.forEach((kpi, index) => {
    const x = margin + index * (kpiWidth + kpiGap)
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(220, 228, 236)
    pdf.roundedRect(x, kpiY, kpiWidth, 32, 1.5, 1.5, 'FD')
    pdf.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2])
    pdf.rect(x, kpiY, kpiWidth, 1.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(5.7)
    pdf.setTextColor(91, 105, 122)
    pdf.text(kpi.label, x + 3, kpiY + 7)
    pdf.setFontSize(8.1)
    pdf.setTextColor(15, 23, 42)
    pdf.text(kpi.value, x + 3, kpiY + 16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(5.7)
    pdf.setTextColor(117, 128, 144)
    pdf.text(kpi.note, x + 3, kpiY + 25)
  })

  // Collections table with mix-of-worked percentages.
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(15, 23, 42)
  pdf.text('REVENUE CHANNEL / INCOME SOURCE', margin, 84)
  drawTable(pdf, margin, 88, [65, 48, 39, contentWidth - 152],
    ['Revenue channel / income source', 'Payment mode', 'Amount (UGX)', '% of worked'], [
      { cells: ['MTN Mobile Money Collections', 'Mobile Wallet (MTN)', formatMoney(summary.mtn_amount), shares(summary.mtn_amount)] },
      { cells: ['Airtel Mobile Money Collections', 'Mobile Wallet (Airtel)', formatMoney(summary.airtel_amount), shares(summary.airtel_amount)] },
      { cells: ['Cash Deposited (Physical Cash)', 'Physical Currency (Till)', formatMoney(summary.cash_deposited), shares(summary.cash_deposited)] },
      { cells: ['TOTAL AMOUNT WORKED', 'Gross revenue aggregate', formatMoney(worked), '100.0%'], total: true },
    ])

  // Cash reconciliation separates receipts from expenses and the remaining balance.
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(15, 23, 42)
  pdf.text('CASH RECONCILIATION', margin, 160)
  drawTable(pdf, margin, 164, [68, 42, 38, contentWidth - 148],
    ['Cash reconciliation line item', 'Category', 'Amount (UGX)', 'Net effect'], [
      { cells: ['Physical Cash Sales Received', 'Cash intake', formatMoney(summary.cash_deposited), 'Inflow'] },
      { cells: ['Total Operational Expenses', 'Disbursements', formatMoney(summary.expenses), 'Expense'], expense: true },
      { cells: ['FINAL CASH AT HAND', 'Reconciled balance', formatMoney(cashAtHand), 'Remaining'], total: true },
    ])

  // Record metadata and any over-expense alert; all displayed amounts stay non-negative.
  const metaY = 224
  pdf.setFillColor(247, 249, 251)
  pdf.setDrawColor(220, 228, 236)
  pdf.roundedRect(margin, metaY, contentWidth, 21, 2, 2, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6.2)
  pdf.setTextColor(91, 105, 122)
  pdf.text('RECORDED BY', margin + 5, metaY + 7)
  pdf.text('SUNDAY DATE', margin + 100, metaY + 7)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(15, 23, 42)
  pdf.text(pdf.splitTextToSize(cashier, 88).slice(0, 1), margin + 5, metaY + 15)
  pdf.text(summary.sunday_date, margin + 100, metaY + 15)

  if (shortfall > 0) {
    pdf.setFillColor(255, 247, 237)
    pdf.setDrawColor(253, 186, 116)
    pdf.roundedRect(margin, 250, contentWidth, 11, 2, 2, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(154, 77, 28)
    pdf.text(`Expense shortfall: ${formatMoney(shortfall)} more than cash deposited.`, margin + 4, 257)
  }

  pdf.setDrawColor(220, 228, 236)
  pdf.line(margin, 278, pageWidth - margin, 278)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.5)
  pdf.setTextColor(117, 128, 144)
  pdf.text('Sunday Close  |  Internal sales record', margin, 285)
  pdf.text('UGX  ·  East Africa Time', pageWidth - margin, 285, { align: 'right' })

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
