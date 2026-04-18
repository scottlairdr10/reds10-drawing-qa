import { useState, useRef, useCallback, useEffect } from 'react'

const BRAND = { red: '#de134d', charcoal: '#40404c', chalk: '#e3ded2', teal: '#69c0b0' }

const RAG = {
  RED:   { bg: '#fdecea', text: '#a32d2d', dot: '#de134d', border: '#f5c1c1' },
  AMBER: { bg: '#fef6e4', text: '#854f0b', dot: '#ef9f27', border: '#fad98a' },
  GREEN: { bg: '#eaf3de', text: '#3b6d11', dot: '#639922', border: '#b8dca0' },
  NA:    { bg: '#f0f0ee', text: '#888',    dot: '#bbb',    border: '#ddd'    },
}

const SYSTEM_PROMPT = `You are a specialist drawing QA reviewer for Reds10 Group, a UK volumetric modular construction company. Review drawings against ISO 19650 file naming, NDSS 2015 space standards, UK Building Regulations (Parts A, B, F, L, M), British Standards, Reds10 internal standards, and Employer Requirements.

Run all 8 QA phases:
1. Title Block Completeness
2. ISO 19650 File Naming & Metadata
3. Dimensional Accuracy & Coordination
4. Regulatory Compliance (NDSS, Building Regs, BS)
5. Employer Requirements Alignment
6. Reds10 Internal Standards & Conventions
7. Clash & Coordination Checks
8. Risks, Gaps & Missing Information

For each phase assign RAG (RED/AMBER/GREEN/NA) and list findings with actions.

Respond ONLY in this exact JSON (no markdown, no preamble):
{"summary":"one sentence overview","drawingRef":"ref or Unknown","drawingType":"type identified","overallRAG":"RED|AMBER|GREEN","phases":[{"id":1,"name":"Title Block Completeness","rag":"RED|AMBER|GREEN|NA","naReason":null,"findings":[{"rag":"RED|AMBER|GREEN","finding":"issue description","action":"what to do"}]}],"criticalFindings":[{"phase":"phase name","finding":"description","action":"required action"}],"issueRecommendation":"one line verdict on readiness to issue"}`

const PHASES = [
  [1, 'Title block completeness'],
  [2, 'ISO 19650 file naming'],
  [3, 'Dimensional accuracy'],
  [4, 'Regulatory compliance'],
  [5, 'Employer requirements'],
  [6, 'Reds10 internal standards'],
  [7, 'Clash & coordination'],
  [8, 'Risks, gaps & missing info'],
]

const PRESETS = [
  { name: 'My standard', phases: [1,2,3,6,8] },
  { name: 'Full check', phases: [1,2,3,4,5,6,7,8] },
  { name: 'Title block only', phases: [1,2] },
]

function RAGBadge({ status, small }) {
  const c = RAG[status] || RAG.NA
  const size = small ? { fontSize: 10, padding: '2px 7px', gap: 3 } : { fontSize: 11, padding: '3px 9px', gap: 4 }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', background: c.bg, color: c.text, borderRadius: 20, fontWeight: 700, letterSpacing: 0.2, border: `1px solid ${c.border}`, ...size }}>
      <span style={{ width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: '50%', background: c.dot, display: 'inline-block', marginRight: size.gap - 1 }} />
      {status}
    </span>
  )
}

function PhaseRow({ phase }) {
  const [open, setOpen] = useState(false)
  const c = RAG[phase.rag] || RAG.NA
  return (
    <div style={{ borderBottom: '1px solid #f0ede8' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', cursor: 'pointer', background: open ? '#fafaf8' : 'transparent', userSelect: 'none' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: BRAND.charcoal }}>Phase {phase.id} — {phase.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <RAGBadge status={phase.rag} small />
          <span style={{ fontSize: 12, color: '#bbb', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 14px 10px', background: '#fafaf8' }}>
          {phase.naReason && <p style={{ fontSize: 11, color: '#999', fontStyle: 'italic', margin: '6px 0 0' }}>Not applicable: {phase.naReason}</p>}
          {phase.findings?.map((f, i) => {
            const fc = RAG[f.rag] || RAG.AMBER
            return (
              <div key={i} style={{ background: fc.bg, borderLeft: `3px solid ${fc.dot}`, borderRadius: '0 5px 5px 0', padding: '7px 10px', marginTop: 7 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: fc.text, marginBottom: 2 }}>{f.finding}</div>
                <div style={{ fontSize: 10, color: '#777' }}>→ {f.action}</div>
              </div>
            )
          })}
          {(!phase.findings?.length && !phase.naReason) && <p style={{ fontSize: 11, color: '#3b6d11', margin: '6px 0 0' }}>✓ No issues found.</p>}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [drawings, setDrawings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [chatMessages, setChatMessages] = useState({})
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [tab, setTab] = useState('review')
  const [historyList, setHistoryList] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [colView, setColView] = useState('preview') // 'preview' | 'phases' | 'results'
  const [selectedPhases, setSelectedPhases] = useState(new Set([1,2,3,6,8]))
  const [savedPresets, setSavedPresets] = useState(PRESETS)
  const fileRef = useRef()
  const chatBottomRef = useRef()
  const selected = drawings.find(d => d.id === selectedId)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, selectedId])

  const analyseDrawing = useCallback(async (drawing, b64, mtype, phasesToRun) => {
    const phaseList = phasesToRun || [1,2,3,4,5,6,7,8]
    const phaseNames = PHASES.filter(([id]) => phaseList.includes(id)).map(([id, name]) => `${id}. ${name}`).join('\n')
    const dynamicPrompt = `You are a specialist drawing QA reviewer for Reds10 Group, a UK volumetric modular construction company. Review drawings against ISO 19650 file naming, NDSS 2015 space standards, UK Building Regulations (Parts A, B, F, L, M), British Standards, Reds10 internal standards, and Employer Requirements.

Run ONLY these QA phases (skip others, mark as NA with reason "Not selected"):
${phaseNames}

For each phase assign RAG (RED/AMBER/GREEN/NA) and list findings with actions.

Respond ONLY in this exact JSON (no markdown, no preamble):
{"summary":"one sentence overview","drawingRef":"ref or Unknown","drawingType":"type identified","overallRAG":"RED|AMBER|GREEN","phases":[{"id":1,"name":"Title Block Completeness","rag":"RED|AMBER|GREEN|NA","naReason":null,"findings":[{"rag":"RED|AMBER|GREEN","finding":"issue description","action":"what to do"}]}],"criticalFindings":[{"phase":"phase name","finding":"description","action":"required action"}],"issueRecommendation":"one line verdict on readiness to issue"}`
    setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, loading: true } : d))
    try {
      const messages = b64
        ? [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mtype || 'image/png', data: b64 } },
            { type: 'text', text: 'Perform a full QA review of this drawing across all 8 phases. Return only valid JSON.' }
          ]}]
        : [{ role: 'user', content: `Perform a full QA review of drawing "${drawing.name}" across all 8 phases. No image available — assess from filename only. Return only valid JSON.` }]

      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: dynamicPrompt, messages }),
      })
      const data = await res.json()
      const text = data.content?.map(c => c.text || '').join('')
      const result = JSON.parse(text.replace(/```json|```/g, '').trim())
      setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, loading: false, result } : d))
      setHistoryList(prev => [{ name: drawing.name, result, date: new Date().toLocaleDateString('en-GB') }, ...prev.slice(0, 29)])
      setSelectedId(prev => prev ?? drawing.id)
    } catch (e) {
      console.error(e)
      setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, loading: false, error: true } : d))
    }
  }, [])

  const handleFiles = useCallback((files) => {
    Array.from(files).forEach(file => {
      const id = Date.now() + Math.random()
      const previewUrl = file.type.startsWith('image/') || file.type === 'application/pdf'
        ? URL.createObjectURL(file) : null
      const drawing = { id, name: file.name, fileType: file.type, previewUrl, loading: false, error: false, result: null, fileObj: file }
      setDrawings(prev => [...prev, drawing])
      setSelectedId(id)
      setColView('preview')
    })
  }, [])

  const runQA = useCallback((drawing, phases) => {
    setColView('results')
    const file = drawing.fileObj
    if (!file) { analyseDrawing(drawing, null, null, [...phases]); return }
    if (file.type === 'application/pdf') {
      const url = URL.createObjectURL(file)
      const loadScript = () => new Promise(resolve => {
        if (window.pdfjsLib) return resolve()
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; resolve() }
        document.head.appendChild(s)
      })
      loadScript().then(() => {
        window.pdfjsLib.getDocument(url).promise.then(pdf => {
          pdf.getPage(1).then(page => {
            const scale = 2
            const viewport = page.getViewport({ scale })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise.then(() => {
              const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
              analyseDrawing(drawing, b64, 'image/jpeg', [...phases])
            })
          })
        })
      })
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => analyseDrawing(drawing, e.target.result.split(',')[1], file.type, [...phases])
      reader.readAsDataURL(file)
    } else {
      analyseDrawing(drawing, null, null, [...phases])
    }
  }, [analyseDrawing])

  const sendChat = async () => {
    if (!chatInput.trim() || !selected?.result) return
    const id = selected.id
    const text = chatInput.trim()
    setChatInput('')
    const prev = chatMessages[id] || []
    const updated = [...prev, { role: 'user', content: text }]
    setChatMessages(m => ({ ...m, [id]: updated }))
    setChatLoading(true)
    try {
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: `You are a drawing QA expert for Reds10 Group. The drawing is: ${selected.result?.drawingRef || selected.name}. Full QA result: ${JSON.stringify(selected.result)}. Answer questions concisely and professionally.`,
          messages: updated,
        }),
      })
      const data = await res.json()
      const reply = data.content?.map(c => c.text || '').join('') || 'No response.'
      setChatMessages(m => ({ ...m, [id]: [...updated, { role: 'assistant', content: reply }] }))
    } catch {
      setChatMessages(m => ({ ...m, [id]: [...updated, { role: 'assistant', content: 'Error — please try again.' }] }))
    }
    setChatLoading(false)
  }

  const exportReport = () => {
    const reviewed = drawings.filter(d => d.result)
    if (!reviewed.length) return

    const ragLabel = { RED: '🔴 RED', AMBER: '🟡 AMBER', GREEN: '🟢 GREEN', NA: '⚪ N/A' }
    const ragColour = { RED: '#C00000', AMBER: '#C55A11', GREEN: '#375623', NA: '#666666' }
    const ragBg = { RED: '#FCE4E4', AMBER: '#FEF2CC', GREEN: '#EBF1DE', NA: '#F2F2F2' }

    const phaseTable = (phases) => phases.map(p => {
      const rl = ragLabel[p.rag] || p.rag
      const rc = ragColour[p.rag] || '#333'
      const rb = ragBg[p.rag] || '#fff'
      const findings = p.naReason
        ? `<tr><td colspan="3" style="font-style:italic;color:#888;padding:4pt 8pt;">Not applicable: ${p.naReason}</td></tr>`
        : p.findings?.length
          ? p.findings.map(f => `<tr>
              <td style="width:80pt;padding:4pt 8pt;border:0.5pt solid #ccc;background:${ragBg[f.rag]||'#fff'};color:${ragColour[f.rag]||'#333'};font-weight:bold;font-size:9pt;">${ragLabel[f.rag]||f.rag}</td>
              <td style="padding:4pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${f.finding}</td>
              <td style="padding:4pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${f.action}</td>
            </tr>`).join('')
          : `<tr><td colspan="3" style="padding:4pt 8pt;color:#375623;font-size:9pt;">✓ No issues found.</td></tr>`
      return `
        <tr style="background:#40404c;">
          <td colspan="2" style="padding:5pt 8pt;color:#e3ded2;font-weight:bold;font-size:10pt;border:none;">Phase ${p.id} — ${p.name}</td>
          <td style="padding:5pt 8pt;background:${rb};color:${rc};font-weight:bold;font-size:10pt;border:none;text-align:right;">${rl}</td>
        </tr>
        ${findings}`
    }).join('')

    const drawingSections = reviewed.map(d => {
      const r = d.result
      const overallBg = ragBg[r.overallRAG] || '#f7f5f1'
      const overallC = ragColour[r.overallRAG] || '#333'
      const critRows = r.criticalFindings?.length
        ? r.criticalFindings.map((f, i) => `<tr>
            <td style="width:24pt;padding:4pt 8pt;border:0.5pt solid #f5c1c1;background:#FCE4E4;color:#C00000;font-weight:bold;font-size:9pt;">${i+1}</td>
            <td style="padding:4pt 8pt;border:0.5pt solid #f5c1c1;font-size:9pt;">${f.phase}</td>
            <td style="padding:4pt 8pt;border:0.5pt solid #f5c1c1;color:#C00000;font-weight:bold;font-size:9pt;">${f.finding}</td>
            <td style="padding:4pt 8pt;border:0.5pt solid #f5c1c1;font-size:9pt;">${f.action}</td>
          </tr>`).join('')
        : `<tr><td colspan="4" style="padding:4pt 8pt;color:#375623;font-size:9pt;">No critical findings.</td></tr>`
      return `
        <div style="page-break-inside:avoid;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:4pt;">
            <tr>
              <td style="background:#de134d;padding:8pt 12pt;border:none;">
                <span style="font-size:14pt;font-weight:bold;color:#ffffff;font-family:Arial;">${r.drawingRef}</span><br>
                <span style="font-size:10pt;color:rgba(255,255,255,0.85);font-family:Arial;">${r.drawingType}</span>
              </td>
              <td style="background:${overallBg};padding:8pt 12pt;text-align:right;border:none;width:120pt;">
                <span style="font-size:12pt;font-weight:bold;color:${overallC};font-family:Arial;">${ragLabel[r.overallRAG]||r.overallRAG}</span>
              </td>
            </tr>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:8pt;">
            <tr>
              <td style="background:#f7f5f1;padding:8pt 12pt;border-left:3pt solid #de134d;font-size:10pt;font-family:Arial;color:#40404c;">
                <strong>Issue Recommendation:</strong> ${r.issueRecommendation}
              </td>
            </tr>
            <tr>
              <td style="padding:6pt 12pt;font-size:10pt;font-family:Arial;color:#555;border-top:0.5pt solid #e0ddd7;">
                ${r.summary}
              </td>
            </tr>
          </table>

          <p style="font-size:10pt;font-weight:bold;color:#40404c;font-family:Arial;margin:8pt 0 4pt;">Critical Findings</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:12pt;">
            <tr style="background:#40404c;">
              <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">#</th>
              <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Phase</th>
              <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Finding</th>
              <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Action Required</th>
            </tr>
            ${critRows}
          </table>

          <p style="font-size:10pt;font-weight:bold;color:#40404c;font-family:Arial;margin:8pt 0 4pt;">QA Phase Results</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20pt;">
            <tr style="background:#40404c;">
              <th colspan="2" style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Phase</th>
              <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Status</th>
            </tr>
            ${phaseTable(r.phases || [])}
          </table>
        </div>`
    }).join('<br style="page-break-after:always;">')

    const batchSummaryRows = reviewed.map(d => {
      const r = d.result
      return `<tr>
        <td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-weight:bold;font-size:9pt;">${r.drawingRef}</td>
        <td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${r.drawingType}</td>
        <td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-weight:bold;color:${ragColour[r.overallRAG]||'#333'};background:${ragBg[r.overallRAG]||'#fff'};font-size:9pt;">${ragLabel[r.overallRAG]||r.overallRAG}</td>
        <td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${r.criticalFindings?.length||0}</td>
        <td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${r.issueRecommendation}</td>
      </tr>`
    }).join('')

    const redC = reviewed.filter(d => d.result?.overallRAG === 'RED').length
    const ambC = reviewed.filter(d => d.result?.overallRAG === 'AMBER').length
    const grnC = reviewed.filter(d => d.result?.overallRAG === 'GREEN').length

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 1.5cm 2cm; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #40404c; margin: 0; }
  h1 { font-size: 20pt; color: #de134d; margin: 0 0 4pt; }
  h2 { font-size: 13pt; color: #40404c; border-bottom: 1pt solid #de134d; padding-bottom: 3pt; margin: 16pt 0 6pt; }
  p { margin: 4pt 0; }
  table { border-collapse: collapse; }
  th { font-weight: bold; }
</style>
</head>
<body>

<!-- HEADER -->
<table style="width:100%;border-collapse:collapse;margin-bottom:16pt;border-bottom:2pt solid #de134d;">
  <tr>
    <td style="padding:0 0 8pt;border:none;">
      <h1>Reds10 Group</h1>
      <p style="font-size:13pt;color:#40404c;margin:0;font-weight:bold;">Drawing QA Report</p>
    </td>
    <td style="text-align:right;vertical-align:bottom;padding:0 0 8pt;border:none;">
      <p style="font-size:9pt;color:#888;margin:0;">Date: ${new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'})}</p>
      <p style="font-size:9pt;color:#888;margin:0;">Drawings reviewed: ${reviewed.length}</p>
      <p style="font-size:9pt;color:#888;margin:0;">
        <span style="color:#C00000;font-weight:bold;">${redC} RED</span> &nbsp;
        <span style="color:#C55A11;font-weight:bold;">${ambC} AMBER</span> &nbsp;
        <span style="color:#375623;font-weight:bold;">${grnC} GREEN</span>
      </p>
    </td>
  </tr>
</table>

<!-- BATCH SUMMARY -->
<h2>Batch Summary</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:20pt;">
  <tr style="background:#40404c;">
    <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Drawing Ref</th>
    <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Type</th>
    <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Overall RAG</th>
    <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Critical</th>
    <th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Verdict</th>
  </tr>
  ${batchSummaryRows}
</table>

<!-- INDIVIDUAL DRAWING REPORTS -->
<h2>Detailed Drawing Reports</h2>
${drawingSections}

<!-- FOOTER NOTE -->
<table style="width:100%;border-collapse:collapse;margin-top:20pt;border-top:1pt solid #e0ddd7;">
  <tr>
    <td style="padding:8pt 0;font-size:8pt;color:#999;border:none;">
      Generated by Reds10 Drawing QA &nbsp;|&nbsp; Reds10 Group &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-GB')}
    </td>
    <td style="text-align:right;padding:8pt 0;font-size:8pt;color:#de134d;font-weight:bold;border:none;">CONFIDENTIAL</td>
  </tr>
</table>

</body></html>`

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Reds10-Drawing-QA-${new Date().toISOString().slice(0, 10)}.doc`
    a.click()
  }

  const redCount = drawings.filter(d => d.result?.overallRAG === 'RED').length
  const ambCount = drawings.filter(d => d.result?.overallRAG === 'AMBER').length
  const grnCount = drawings.filter(d => d.result?.overallRAG === 'GREEN').length
  const msgs = chatMessages[selectedId] || []
  const rc = RAG[selected?.result?.overallRAG] || RAG.NA

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f7f5f1', overflow: 'hidden' }}>

      {/* ── COL 1: Sidebar ── */}
      <div style={{ width: 230, background: BRAND.charcoal, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 5, height: 22, background: BRAND.red, borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.chalk, letterSpacing: 0.4 }}>Reds10</div>
            <div style={{ fontSize: 8, color: 'rgba(227,222,210,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Drawing QA</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {['review', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', background: 'transparent', border: 'none', cursor: 'pointer', color: tab === t ? BRAND.chalk : 'rgba(227,222,210,0.3)', borderBottom: tab === t ? `2px solid ${BRAND.red}` : '2px solid transparent' }}>{t}</button>
          ))}
        </div>

        {tab === 'review' ? (
          <>
            {/* Drop zone */}
            <div
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{ margin: 10, border: `1.5px dashed ${dragOver ? BRAND.chalk : 'rgba(227,222,210,0.25)'}`, borderRadius: 8, padding: '13px 8px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s', background: dragOver ? 'rgba(255,255,255,0.04)' : 'transparent' }}
            >
              <div style={{ fontSize: 18, color: 'rgba(227,222,210,0.4)', marginBottom: 3 }}>+</div>
              <div style={{ fontSize: 9, color: 'rgba(227,222,210,0.45)', lineHeight: 1.6 }}>Drop drawings here<br />or click to browse</div>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
            </div>

            {/* Drawing list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
              {drawings.length === 0 && <div style={{ fontSize: 9, color: 'rgba(227,222,210,0.22)', textAlign: 'center', marginTop: 12 }}>No drawings loaded</div>}
              {drawings.map(d => (
                <div key={d.id} onClick={() => setSelectedId(d.id)} style={{ background: selectedId === d.id ? 'rgba(222,19,77,0.18)' : 'rgba(255,255,255,0.05)', border: selectedId === d.id ? `1.5px solid ${BRAND.red}` : '1.5px solid transparent', borderRadius: 7, padding: '8px 10px', cursor: 'pointer', marginBottom: 5, transition: 'all .15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: BRAND.chalk, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 105 }}>{d.result?.drawingRef || d.name}</span>
                    {d.result?.overallRAG && <RAGBadge status={d.result.overallRAG} small />}
                    {d.loading && <span style={{ fontSize: 9, color: 'rgba(227,222,210,0.35)', fontStyle: 'italic' }}>…</span>}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(227,222,210,0.38)' }}>{d.result?.drawingType || d.fileType || 'Drawing'}</div>
                </div>
              ))}
            </div>

            {/* Stats + export */}
            {drawings.some(d => d.result) && (
              <>
                <div style={{ padding: '7px 9px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 4 }}>
                  {[['RED', redCount, BRAND.red], ['AMB', ambCount, '#ef9f27'], ['GRN', grnCount, '#639922']].map(([l, c, col]) => (
                    <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '5px 3px', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: col }}>{c}</div>
                      <div style={{ fontSize: 7, color: 'rgba(227,222,210,0.35)', letterSpacing: 0.3 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <button onClick={exportReport} style={{ margin: '0 9px 9px', background: BRAND.red, color: '#fff', border: 'none', borderRadius: 6, padding: '8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Export QA Report</button>
              </>
            )}
          </>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {historyList.length === 0 && <div style={{ fontSize: 9, color: 'rgba(227,222,210,0.22)', textAlign: 'center', marginTop: 12 }}>No history yet</div>}
            {historyList.map((h, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '8px 9px', marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: BRAND.chalk, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 115 }}>{h.result?.drawingRef || h.name}</span>
                  <RAGBadge status={h.result?.overallRAG} small />
                </div>
                <div style={{ fontSize: 8, color: 'rgba(227,222,210,0.3)' }}>{h.date}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── COL 2: Preview / Phase Selector / Results ── */}
      <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e0ddd7', background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e8e5e0', background: '#fff', fontSize: 11, fontWeight: 600, color: BRAND.charcoal, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {colView === 'phases' ? 'Select QA phases to run' : colView === 'results' && selected?.result ? `QA Review — ${selected.result.drawingRef}` : selected ? (selected.result?.drawingRef || selected.name) : 'Drawing Viewer'}
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: colView === 'preview' ? '#f0ede8' : '#fff' }}>

          {/* EMPTY STATE */}
          {!selected && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <div style={{ fontSize: 32, opacity: 0.2 }}>⬡</div>
              <div style={{ fontSize: 12, color: '#ccc' }}>Drop a drawing to begin</div>
            </div>
          )}

          {/* PREVIEW STATE */}
          {selected && colView === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 24 }}>
              <div style={{ width: '100%', maxWidth: 380, background: '#f7f5f1', border: '1px solid #e0ddd7', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: BRAND.charcoal, padding: '7px 14px', fontSize: 9, color: BRAND.chalk, letterSpacing: 0.5 }}>DRAWING PREVIEW</div>
                <div style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 88, height: 100, background: '#fff', border: '1px solid #e0ddd7', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {selected.previewUrl
                      ? <img src={selected.previewUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <div style={{ fontSize: 28, opacity: 0.2 }}>⬡</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.charcoal, marginBottom: 5, wordBreak: 'break-all' }}>{selected.name}</div>
                    <div style={{ fontSize: 10, color: '#bbb', lineHeight: 1.7 }}>
                      {selected.fileType?.includes('pdf') ? 'PDF' : selected.fileType?.split('/')[1]?.toUpperCase() || 'File'}
                    </div>
                    <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 9px', background: '#e1f5ee', color: '#0f6e56', borderRadius: 12, fontWeight: 600 }}>Ready to review</div>
                  </div>
                </div>
              </div>
              <button onClick={() => setColView('phases')} style={{ background: BRAND.red, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 32px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Select QA phases →
              </button>
            </div>
          )}

          {/* PHASE SELECTOR STATE */}
          {selected && colView === 'phases' && (
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#999' }}>Choose which checks to run</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setSelectedPhases(new Set(PHASES.map(p => p[0])))} style={{ fontSize: 10, padding: '3px 9px', background: 'transparent', border: '1px solid #ddd', borderRadius: 5, cursor: 'pointer', color: '#666' }}>All</button>
                  <button onClick={() => setSelectedPhases(new Set())} style={{ fontSize: 10, padding: '3px 9px', background: 'transparent', border: '1px solid #ddd', borderRadius: 5, cursor: 'pointer', color: '#666' }}>None</button>
                </div>
              </div>

              {PHASES.map(([num, label]) => {
                const on = selectedPhases.has(num)
                return (
                  <div key={num} onClick={() => setSelectedPhases(prev => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n })}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: on ? '#fff' : '#fafaf8', border: `1.5px solid ${on ? BRAND.red : '#e8e5e0'}`, borderRadius: 8, cursor: 'pointer', marginBottom: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? BRAND.red : 'transparent', border: on ? 'none' : '2px solid #ccc' }}>
                      {on && <svg width="12" height="10" viewBox="0 0 12 10" style={{ display: 'block' }}><polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <div style={{ fontSize: 12, color: on ? BRAND.charcoal : '#aaa', fontWeight: on ? 500 : 400 }}>Phase {num} — {label}</div>
                  </div>
                )
              })}

              <div style={{ borderTop: '1px solid #e8e5e0', paddingTop: 12, marginTop: 4, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: BRAND.charcoal, marginBottom: 8 }}>Saved presets</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {savedPresets.map(p => {
                    const active = [...selectedPhases].sort().join() === p.phases.slice().sort().join()
                    return (
                      <div key={p.name} onClick={() => setSelectedPhases(new Set(p.phases))}
                        style={{ fontSize: 11, padding: '5px 12px', background: '#fff', border: `1.5px solid ${active ? BRAND.red : '#e0ddd7'}`, borderRadius: 20, color: active ? BRAND.red : '#666', cursor: 'pointer', fontWeight: active ? 500 : 400 }}>
                        {p.name}
                      </div>
                    )
                  })}
                  <div onClick={() => {
                    const name = prompt('Preset name?')
                    if (name) setSavedPresets(prev => [...prev, { name, phases: [...selectedPhases].sort((a,b) => a-b) }])
                  }} style={{ fontSize: 11, padding: '5px 12px', background: '#fff', border: '1.5px dashed #ddd', borderRadius: 20, color: '#bbb', cursor: 'pointer' }}>+ Save current</div>
                </div>
              </div>

              <button
                onClick={() => selectedPhases.size > 0 && runQA(selected, selectedPhases)}
                style={{ width: '100%', background: selectedPhases.size > 0 ? BRAND.red : '#ccc', color: '#fff', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, cursor: selectedPhases.size > 0 ? 'pointer' : 'default' }}>
                {selectedPhases.size === 0 ? 'Select at least one phase' : `Run QA — ${selectedPhases.size} phase${selectedPhases.size > 1 ? 's' : ''} selected →`}
              </button>
            </div>
          )}

          {/* RESULTS / LOADING / ERROR STATE */}
          {selected && colView === 'results' && (
            <>
              {selected.loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 40 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid #e8e5e0`, borderTopColor: BRAND.red, animation: 'spin .8s linear infinite' }} />
                  <div style={{ fontSize: 13, color: BRAND.charcoal, fontWeight: 500 }}>Running QA analysis…</div>
                  <div style={{ width: '100%', maxWidth: 280, background: '#e8e5e0', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: BRAND.red, borderRadius: 4, width: '60%', animation: 'progress 2s ease-in-out infinite' }} />
                  </div>
                  <style>{`@keyframes progress{0%{width:10%}50%{width:80%}100%{width:10%}}`}</style>
                </div>
              )}
              {selected.error && !selected.loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
                  <div style={{ fontSize: 12, color: BRAND.red }}>Analysis failed — please try again.</div>
                  <button onClick={() => setColView('phases')} style={{ fontSize: 11, padding: '6px 14px', background: BRAND.charcoal, color: BRAND.chalk, border: 'none', borderRadius: 6, cursor: 'pointer' }}>← Change phases</button>
                </div>
              )}
              {selected.result && !selected.loading && (
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.charcoal, marginBottom: 1 }}>{selected.result.drawingRef}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{selected.result.drawingType}</div>
                    </div>
                    <RAGBadge status={selected.result.overallRAG} />
                  </div>
                  <div style={{ background: '#f7f5f1', borderRadius: 7, padding: '8px 11px', marginBottom: 10, fontSize: 11, color: '#555', lineHeight: 1.6 }}>{selected.result.summary}</div>
                  <div style={{ background: rc.bg, borderRadius: 7, padding: '8px 11px', marginBottom: 10, border: `1px solid ${rc.border}` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: '#aaa', marginBottom: 3, textTransform: 'uppercase' }}>Issue Recommendation</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.charcoal }}>{selected.result.issueRecommendation}</div>
                  </div>
                  {selected.result.criticalFindings?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: '#aaa', marginBottom: 6, textTransform: 'uppercase' }}>Critical Findings</div>
                      {selected.result.criticalFindings.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, background: '#fdecea', borderRadius: 6, padding: '6px 9px', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: BRAND.red, minWidth: 16 }}>{i + 1}</span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#a32d2d' }}>{f.finding}</div>
                            <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{f.phase} · {f.action}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: '#aaa', marginBottom: 6, textTransform: 'uppercase' }}>QA Phases</div>
                  <div style={{ border: '1px solid #e8e5e0', borderRadius: 7, overflow: 'hidden', marginBottom: 12 }}>
                    {selected.result.phases?.map(p => <PhaseRow key={p.id} phase={p} />)}
                  </div>
                  <button onClick={() => setColView('phases')} style={{ width: '100%', background: BRAND.charcoal, color: BRAND.chalk, border: 'none', borderRadius: 7, padding: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>← Change phases & rerun</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── COL 3: Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #eee', background: '#fafaf8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 4, height: 14, background: BRAND.red, borderRadius: 2 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.charcoal }}>
              {selected?.result ? `Chat — ${selected.result.drawingRef}` : 'Chat'}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            {msgs.length === 0 && (
              <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 20 }}>
                {selected?.result ? 'Ask anything about this drawing' : 'Select a drawing to begin chatting'}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 7 }}>
                <div style={{ maxWidth: '85%', fontSize: 12, lineHeight: 1.6, padding: '6px 11px', borderRadius: m.role === 'user' ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: m.role === 'user' ? BRAND.charcoal : '#f0ede8', color: m.role === 'user' ? BRAND.chalk : BRAND.charcoal }}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', animation: `dp 1.2s ${i * 0.2}s infinite` }} />)}
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          <div style={{ padding: '8px 10px', borderTop: '1px solid #eee', display: 'flex', gap: 6 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder={selected?.result ? 'Ask about this drawing…' : 'Select a drawing first…'}
              disabled={!selected?.result}
              style={{ flex: 1, padding: '7px 11px', borderRadius: 7, border: '1.5px solid #ddd', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: selected?.result ? '#fff' : '#f7f7f7' }}
            />
            <button onClick={sendChat} disabled={!selected?.result || !chatInput.trim()} style={{ background: selected?.result ? BRAND.red : '#ddd', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 13px', fontSize: 12, fontWeight: 600, cursor: selected?.result ? 'pointer' : 'default' }}>Send</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes dp{0%,100%{opacity:.25}50%{opacity:1}}`}</style>
    </div>
  )
}
