// Builds a consistent download filename: `companyname_DDMM.ext`
// e.g. buildDownloadName('Rishabh', 'pdf', '2025-11-13') -> 'rishabh_1311.pdf'

function slugify(name: string | undefined | null): string {
  const base = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || 'report'
}

// Day+month as DDMM. Accepts an ISO `YYYY-MM-DD` string (e.g. the audit date),
// a Date, or nothing (falls back to today).
function ddmm(dateInput?: string | Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (typeof dateInput === 'string') {
    const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}${m[2]}`
  }
  const d = dateInput instanceof Date ? dateInput : new Date()
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}`
}

export function buildDownloadName(
  company: string | undefined | null,
  ext: string,
  dateInput?: string | Date,
): string {
  return `${slugify(company)}_${ddmm(dateInput)}.${ext}`
}
