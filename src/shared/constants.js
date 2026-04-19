// Shared constants and theme for Reds10 Drawing QA
export const BRAND = { red: '#de134d', charcoal: '#40404c', chalk: '#e3ded2' }
export const LOGO  = 'https://raw.githubusercontent.com/scottlairdr10/reds10-brand-skill/main/logo-chalk-primary.png'

export const API_URL = 'https://api.anthropic.com/v1/messages'
export const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
})

export const RAG = {
  RED:   { bg: '#fdecea', text: '#a32d2d', dot: '#de134d', border: '#f5c1c1' },
  AMBER: { bg: '#fef6e4', text: '#854f0b', dot: '#ef9f27', border: '#fad98a' },
  GREEN: { bg: '#eaf3de', text: '#3b6d11', dot: '#639922', border: '#b8dca0' },
  NA:    { bg: '#f0f0ee', text: '#888',    dot: '#bbb',    border: '#ddd'    },
}

export const PHASES = [
  [1,'Title block completeness'],
  [2,'ISO 19650 file naming'],
  [3,'Dimensional accuracy'],
  [4,'Regulatory compliance'],
  [5,'Employer requirements'],
  [6,'Reds10 internal standards'],
  [7,'Clash & coordination'],
  [8,'Risks, gaps & missing info'],
]

export const PRESETS = [
  { name: 'My standard', phases: [1,2,3,6,8] },
  { name: 'Full check',  phases: [1,2,3,4,5,6,7,8] },
  { name: 'Title only',  phases: [1,2] },
]

export const QUICK_ACTIONS = [
  { icon: '📋', label: 'Summarise findings' },
  { icon: '🔧', label: 'What needs fixing first?' },
  { icon: '📄', label: 'Draft RFI' },
  { icon: '📐', label: 'Check NDSS' },
  { icon: '🔥', label: 'Part B details' },
]

export const DRAWING_GROUPS = [
  { id: 'architectural', icon: '🏗️', name: 'Architectural', codes: ['A','AR'] },
  { id: 'structural',    icon: '🔩', name: 'Structural', codes: ['S','ST'] },
  { id: 'mep',           icon: '⚡', name: 'MEP', codes: ['M','E','P','ME','EL','PL'] },
  { id: 'fire',          icon: '🔥', name: 'Fire Strategy', codes: ['F','FS'] },
  { id: 'landscape',     icon: '🌳', name: 'Landscape', codes: ['L','LS'] },
  { id: 'other',         icon: '📄', name: 'Other', codes: [] },
]

// Infer drawing group from filename (ISO 19650 code after discipline position)
export function inferGroup(filename) {
  const name = filename.toUpperCase()
  // Try ISO 19650 pattern: PROJ-ORIG-ZONE-LEVEL-TYPE-DISCIPLINE-NUMBER
  const parts = name.replace(/\.(PNG|JPG|JPEG|PDF|DWG)$/,'').split(/[-_]/)
  // Discipline is typically 6th position (e.g., -A-, -S-, -M-)
  for (const part of parts) {
    if (part.length === 1 || part.length === 2) {
      for (const g of DRAWING_GROUPS) {
        if (g.codes.includes(part)) return g.id
      }
    }
  }
  // Fallback: look for keywords in filename
  if (/ARCH|FLOOR|PLAN|ELEV|LAYOUT/.test(name)) return 'architectural'
  if (/STRUCT|FRAME|FOUND|BEAM|COLUMN/.test(name)) return 'structural'
  if (/MEP|HVAC|ELEC|PLUMB/.test(name)) return 'mep'
  if (/FIRE/.test(name)) return 'fire'
  if (/LAND/.test(name)) return 'landscape'
  return 'other'
}

// Infer project from filename prefix (first part before first dash)
export function inferProject(filename) {
  const m = filename.match(/^([A-Z0-9]+)[-_]/i)
  return m ? m[1].toUpperCase() : 'UNASSIGNED'
}

// localStorage keys
export const STORAGE_KEY = 'reds10-qa-data-v1'

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { drawings: [], projects: [], presets: PRESETS }
}

export function saveState(state) {
  try {
    // Don't save File objects or blob URLs
    const clean = {
      drawings: state.drawings.map(d => ({
        id: d.id, name: d.name, fileType: d.fileType, project: d.project,
        group: d.group, result: d.result, reviewedAt: d.reviewedAt, phasesRun: d.phasesRun,
      })),
      projects: state.projects,
      presets: state.presets,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  } catch(e) { console.warn('save failed', e) }
}

export function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} day${d>1?'s':''} ago`
  return new Date(ts).toLocaleDateString('en-GB')
}
