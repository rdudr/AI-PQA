// Builds a consistent download filename: `companyname_DDMM.ext`
// e.g. buildDownloadName('Rishabh', 'pdf', '2025-11-13') -> 'rishabh_1311.pdf'

function slugify(name: string | undefined | null): string {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Day+month as DDMM. Accepts an ISO `YYYY-MM-DD` string (e.g. the audit date),
// a Date, or nothing (falls back to today).
function ddmm(dateInput?: string | Date | null): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (typeof dateInput === 'string') {
    const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}${m[2]}`
  }
  const d = dateInput instanceof Date ? dateInput : new Date()
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}`
}

export function buildDownloadName(params: {
  company?: string | null
  pqName?: string | null
  machineName?: string | null
  dateInput?: string | Date | null
  ext: string
}): string {
  const parts = [
    slugify(params.company),
    slugify(params.pqName),
    slugify(params.machineName),
    ddmm(params.dateInput)
  ].filter(Boolean)
  
  if (parts.length === 0) return `report.${params.ext}`
  return `${parts.join('_')}.${params.ext}`
}
