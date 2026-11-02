export type SalesDraft = {
  sunday_date: string
  ids_printed: number
  mtn_amount: number
  airtel_amount: number
  expenses: number
  cash_deposited: number
}

export type SalesSummary = SalesDraft & {
  recorded_by: string
  created_at: string
  updated_at: string
  recorder: { display_name: string | null; email: string | null } | null
}

export function getSundayInKampala(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  const sunday = new Date(Date.UTC(year, month - 1, day))
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay())
  return sunday.toISOString().slice(0, 10)
}

export function formatSunday(date: string) {
  return new Intl.DateTimeFormat('en-UG', {
    timeZone: 'Africa/Kampala', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(`${date}T12:00:00+03:00`))
}

export function isSunday(date: string) {
  if (!date) return false
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0
}

export function formatMoney(amount: number) {
  return `UGX ${Math.round(amount).toLocaleString('en-UG')}`
}

export function amountOrZero(value: string) {
  if (value.trim() === '') return 0
  return Math.max(0, Number(value) || 0)
}
