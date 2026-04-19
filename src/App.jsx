import { useState, useRef, useCallback, useEffect } from 'react'

const BRAND = { red: '#de134d', charcoal: '#40404c', chalk: '#e3ded2' }
const LOGO = 'https://raw.githubusercontent.com/scottlairdr10/reds10-brand-skill/main/logo-chalk-primary.png'
const API_URL = 'https://api.anthropic.com/v1/messages'
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
})

const RAG = {
  RED:   { bg: '#fdecea', text: '#a32d2d', dot: '#de134d', border: '#f5c1c1' },
  AMBER: { bg: '#fef6e4', text: '#854f0b', dot: '#ef9f27', border: '#fad98a' },
  GREEN: { bg: '#eaf3de', text: '#3b6d11', dot: '#639922', border: '#b8dca0' },
  NA:    { bg: '#f0f0ee', text: '#888',    dot: '#bbb',    border: '#ddd'    },
}

const PHASES = [
  [1,'Title block completeness'],
  [2,'ISO 19650 file naming'],
  [3,'Dimensional accuracy'],
  [4,'Regulatory compliance'],
  [5,'Employer requirements'],
  [6,'Reds10 internal standards'],
  [7,'Clash & coordination'],
  [8,'Risks, gaps & missing info'],
]

const PRESETS = [
  { name: 'My standard', phases: [1,2,3,6,8] },
  { name: 'Full check',  phases: [1,2,3,4,5,6,7,8] },
  { name: 'Title only',  phases: [1,2] },
]

const QUICK_ACTIONS = [
  { icon: '📋', label: 'Summarise findings' },
  { icon: '🔧', label: 'What needs fixing first?' },
  { icon: '📄', label: 'Draft RFI' },
  { icon: '📐', label: 'Check NDSS' },
  { icon: '🔥', label: 'Part B details' },
]

function RAGBadge({ status, size = 'md' }) {
  const c = RAG[status] || RAG.NA
  const sz = size === 'sm' ? { fontSize:9, padding:'2px 7px', gap:3 }
           : size === 'lg' ? { fontSize:12, padding:'5px 14px', gap:5 }
           : { fontSize:10, padding:'3px 9px', gap:4 }
  const dotSz = size === 'sm' ? 5 : size === 'lg' ? 8 : 6
  return (
    <span style={{ display:'inline-flex', alignItems:'center', background:c.bg, color:c.text,
      borderRadius:20, fontWeight:700, border:`1px solid ${c.border}`, whiteSpace:'nowrap', ...sz }}>
      <span style={{ width:dotSz, height:dotSz, borderRadius:'50%', background:c.dot,
        display:'inline-block', marginRight:sz.gap-1 }} />
      {status}
    </span>
  )
}

function PhaseRow({ phase }) {
  const [open, setOpen] = useState(false)
  const c = RAG[phase.rag] || RAG.NA
  const rowBg = phase.rag === 'AMBER' ? '#fffbf0' : phase.rag === 'RED' ? '#fff8f8' : phase.rag === 'GREEN' ? '#f5fbf0' : 'transparent'
  const rowBorder = phase.rag === 'AMBER' ? '#fad98a' : phase.rag === 'RED' ? '#f5c1c1' : phase.rag === 'GREEN' ? '#b8dca0' : '#e8e5e0'
  return (
    <div style={{ borderRadius:6, marginBottom:4, border:`1px solid ${rowBorder}`, background:rowBg, overflow:'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'7px 10px', cursor:'pointer', userSelect:'none' }}>
        <span style={{ fontSize:10, fontWeight:500, color:BRAND.charcoal }}>Phase {phase.id} — {phase.name}</span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <RAGBadge status={phase.rag} size="sm" />
          <span style={{ fontSize:11, color:'#bbb', transform:open?'rotate(90deg)':'none', transition:'transform 0.2s' }}>›</span>
        </div>
      </div>
      {open && (
        <div style={{ padding:'0 10px 8px', borderTop:`1px solid ${rowBorder}` }}>
          {phase.naReason && <p style={{ fontSize:10, color:'#999', fontStyle:'italic', margin:'6px 0 0' }}>N/A: {phase.naReason}</p>}
          {phase.findings?.map((f,i) => {
            const fc = RAG[f.rag] || RAG.AMBER
            return (
              <div key={i} style={{ background:fc.bg, borderLeft:`3px solid ${fc.dot}`, borderRadius:'0 4px 4px 0',
                padding:'6px 9px', marginTop:6 }}>
                <div style={{ fontSize:10, fontWeight:600, color:fc.text, marginBottom:1 }}>{f.finding}</div>
                <div style={{ fontSize:9, color:'#777' }}>→ {f.action}</div>
              </div>
            )
          })}
          {(!phase.findings?.length && !phase.naReason) && (
            <p style={{ fontSize:10, color:'#3b6d11', margin:'6px 0 0' }}>✓ No issues found.</p>
          )}
        </div>
      )}
    </div>
  )
}

function MarkdownText({ text }) {
  // Simple markdown: **bold**, bullet lists, line breaks
  const lines = text.split('\n')
  return (
    <div style={{ fontSize:11, lineHeight:1.65, color:BRAND.charcoal }}>
      {lines.map((line, i) => {
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <div key={i} style={{ display:'flex', gap:6, marginTop:2 }}>
            <span style={{ color:'#de134d', fontWeight:700, flexShrink:0 }}>·</span>
            <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          </div>
        }
        if (line.trim() === '') return <div key={i} style={{ height:6 }} />
        return <div key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      })}
    </div>
  )
}

export default function App() {
  const [drawings, setDrawings]           = useState([])
  const [selectedId, setSelectedId]       = useState(null)
  const [tab, setTab]                     = useState('review')
  const [historyList, setHistoryList]     = useState([])
  const [dragOver, setDragOver]           = useState(false)
  const [colView, setColView]             = useState('preview') // preview | phases | results
  const [selectedPhases, setSelectedPhases] = useState(new Set([1,2,3,6,8]))
  const [savedPresets, setSavedPresets]   = useState(PRESETS)
  // Chat
  const [messages, setMessages]           = useState({}) // id -> [{role,content,b64?}]
  const [chatInput, setChatInput]         = useState('')
  const [chatLoading, setChatLoading]     = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const fileRef   = useRef()
  const chatRef   = useRef()
  const chatBottom = useRef()
  const selected = drawings.find(d => d.id === selectedId)

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, streamingText, selectedId])

  // ── Analyse drawing ──────────────────────────────────────────
  const analyseDrawing = useCallback(async (drawing, b64, mtype, phasesToRun) => {
    const phaseList = phasesToRun || [1,2,3,4,5,6,7,8]
    const phaseNames = PHASES.filter(([id]) => phaseList.includes(id)).map(([id,name]) => `${id}. ${name}`).join('\n')
    const system = `You are a specialist drawing QA reviewer for Reds10 Group, a UK volumetric modular construction company.
Review drawings against ISO 19650 file naming, NDSS 2015 space standards, UK Building Regulations (Parts A,B,F,L,M), British Standards, Reds10 internal standards, and Employer Requirements.

Run ONLY these QA phases (mark others as NA with reason "Not selected"):
${phaseNames}

For each phase assign RAG (RED/AMBER/GREEN/NA) and list findings with actions.
Respond ONLY in this exact JSON (no markdown, no preamble):
{"summary":"one sentence overview","drawingRef":"ref or Unknown","drawingType":"type identified","overallRAG":"RED|AMBER|GREEN","phases":[{"id":1,"name":"Title Block Completeness","rag":"RED|AMBER|GREEN|NA","naReason":null,"findings":[{"rag":"RED|AMBER|GREEN","finding":"issue description","action":"what to do"}]}],"criticalFindings":[{"phase":"phase name","finding":"description","action":"required action"}],"issueRecommendation":"one line verdict on readiness to issue"}`

    setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, loading:true, error:false } : d))
    try {
      const userContent = b64
        ? [{ type:'image', source:{ type:'base64', media_type:mtype||'image/png', data:b64 } },
           { type:'text', text:'Perform a full QA review of this drawing across all selected phases. Return only valid JSON.' }]
        : `Perform a full QA review of drawing "${drawing.name}". No image — assess from filename only. Return only valid JSON.`

      const res = await fetch(API_URL, {
        method:'POST', headers:getHeaders(),
        body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:2000, system, messages:[{ role:'user', content:userContent }] }),
      })
      if (!res.ok) { const e = await res.text(); console.error('API',res.status,e); throw new Error(`API ${res.status}`) }
      const data = await res.json()
      const text = data.content?.map(c => c.text||'').join('')
      if (!text) throw new Error('Empty')
      const result = JSON.parse(text.replace(/```json|```/g,'').trim())
      setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, loading:false, result } : d))
      setHistoryList(prev => [{ name:drawing.name, result, date:new Date().toLocaleDateString('en-GB') }, ...prev.slice(0,29)])
      setColView('results')
    } catch(e) {
      console.error('analyseDrawing',e)
      setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, loading:false, error:true } : d))
    }
  }, [])

  // ── File handling ─────────────────────────────────────────────
  const handleFiles = useCallback((files) => {
    Array.from(files).forEach(file => {
      const id = Date.now() + Math.random()
      const previewUrl = (file.type.startsWith('image/')||file.type==='application/pdf') ? URL.createObjectURL(file) : null
      setDrawings(prev => [...prev, { id, name:file.name, fileType:file.type, previewUrl, loading:false, error:false, result:null, fileObj:file }])
      setSelectedId(id)
      setColView('preview')
    })
  }, [])

  // ── Run QA ───────────────────────────────────────────────────
  const runQA = useCallback((drawing, phases) => {
    setColView('results')
    const file = drawing.fileObj
    if (!file) { analyseDrawing(drawing, null, null, [...phases]); return }
    if (file.type === 'application/pdf') {
      const loadScript = () => new Promise(resolve => {
        if (window.pdfjsLib) return resolve()
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; resolve() }
        document.head.appendChild(s)
      })
      loadScript().then(() => {
        window.pdfjsLib.getDocument(URL.createObjectURL(file)).promise.then(pdf => {
          pdf.getPage(1).then(page => {
            const vp = page.getViewport({ scale:2 })
            const canvas = document.createElement('canvas')
            canvas.width = vp.width; canvas.height = vp.height
            page.render({ canvasContext:canvas.getContext('2d'), viewport:vp }).promise.then(() => {
              analyseDrawing(drawing, canvas.toDataURL('image/jpeg',0.85).split(',')[1], 'image/jpeg', [...phases])
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

  // ── Chat: streaming ──────────────────────────────────────────
  const sendChat = useCallback(async (inputText) => {
    const text = inputText || chatInput.trim()
    if (!text || !selected?.result) return
    setChatInput('')
    const id = selected.id
    const prev = messages[id] || []

    // Build message with drawing image if available
    let userContent
    if (selected.fileObj && selected.fileObj.type.startsWith('image/')) {
      const b64 = await new Promise(resolve => {
        const r = new FileReader()
        r.onload = e => resolve(e.target.result.split(',')[1])
        r.readAsDataURL(selected.fileObj)
      })
      userContent = [
        { type:'image', source:{ type:'base64', media_type:selected.fileObj.type, data:b64 } },
        { type:'text', text }
      ]
    } else {
      userContent = text
    }

    const updated = [...prev, { role:'user', content:text }]
    setMessages(m => ({ ...m, [id]: updated }))
    setChatLoading(true)
    setStreamingText('')

    try {
      const apiMessages = prev.map(m => ({ role:m.role, content:m.content }))
      apiMessages.push({ role:'user', content:userContent })

      const res = await fetch(API_URL, {
        method:'POST', headers:getHeaders(),
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:1500, stream:true,
          system:`You are a specialist drawing QA expert for Reds10 Group. You have access to the drawing image and the full QA result below.
Drawing: ${selected.result?.drawingRef || selected.name}
Type: ${selected.result?.drawingType || 'Unknown'}
Overall RAG: ${selected.result?.overallRAG}
QA Summary: ${selected.result?.summary}
Issue Recommendation: ${selected.result?.issueRecommendation}
Critical Findings: ${JSON.stringify(selected.result?.criticalFindings)}
Phase Results: ${JSON.stringify(selected.result?.phases)}

Answer questions concisely and professionally. Use **bold** for emphasis. Use bullet points for lists. Reference phase numbers and specific findings when relevant.`,
          messages: apiMessages,
        }),
      })

      if (!res.ok) throw new Error(`API ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.delta?.text || ''
              if (delta) { fullText += delta; setStreamingText(fullText) }
            } catch {}
          }
        }
      }

      setMessages(m => ({ ...m, [id]: [...updated, { role:'assistant', content:fullText }] }))
      setStreamingText('')
    } catch(e) {
      console.error('chat error',e)
      setMessages(m => ({ ...m, [id]: [...updated, { role:'assistant', content:'Error — please try again.' }] }))
      setStreamingText('')
    }
    setChatLoading(false)
  }, [chatInput, messages, selected])

  // ── Export ───────────────────────────────────────────────────
  const exportReport = () => {
    const reviewed = drawings.filter(d => d.result)
    if (!reviewed.length) return
    const rl = { RED:'🔴 RED', AMBER:'🟡 AMBER', GREEN:'🟢 GREEN', NA:'⚪ N/A' }
    const rc = { RED:'#C00000', AMBER:'#C55A11', GREEN:'#375623', NA:'#666' }
    const rb = { RED:'#FCE4E4', AMBER:'#FEF2CC', GREEN:'#EBF1DE', NA:'#F2F2F2' }
    const phaseRows = phases => phases.map(p => {
      const findings = p.naReason
        ? `<tr><td colspan="3" style="font-style:italic;color:#888;padding:4pt 8pt;">N/A: ${p.naReason}</td></tr>`
        : p.findings?.length
          ? p.findings.map(f=>`<tr><td style="width:80pt;padding:4pt 8pt;border:0.5pt solid #ccc;background:${rb[f.rag]||'#fff'};color:${rc[f.rag]||'#333'};font-weight:bold;font-size:9pt;">${rl[f.rag]||f.rag}</td><td style="padding:4pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${f.finding}</td><td style="padding:4pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${f.action}</td></tr>`).join('')
          : `<tr><td colspan="3" style="padding:4pt 8pt;color:#375623;font-size:9pt;">✓ No issues.</td></tr>`
      return `<tr style="background:#40404c;"><td colspan="2" style="padding:5pt 8pt;color:#e3ded2;font-weight:bold;font-size:10pt;border:none;">Phase ${p.id} — ${p.name}</td><td style="padding:5pt 8pt;background:${rb[p.rag]||'#f7f5f1'};color:${rc[p.rag]||'#333'};font-weight:bold;font-size:10pt;border:none;text-align:right;">${rl[p.rag]||p.rag}</td></tr>${findings}`
    }).join('')
    const sections = reviewed.map(d => {
      const r = d.result
      const critRows = r.criticalFindings?.length
        ? r.criticalFindings.map((f,i)=>`<tr><td style="width:24pt;padding:4pt 8pt;border:0.5pt solid #f5c1c1;background:#FCE4E4;color:#C00000;font-weight:bold;font-size:9pt;">${i+1}</td><td style="padding:4pt 8pt;border:0.5pt solid #f5c1c1;font-size:9pt;">${f.phase}</td><td style="padding:4pt 8pt;border:0.5pt solid #f5c1c1;color:#C00000;font-weight:bold;font-size:9pt;">${f.finding}</td><td style="padding:4pt 8pt;border:0.5pt solid #f5c1c1;font-size:9pt;">${f.action}</td></tr>`).join('')
        : `<tr><td colspan="4" style="padding:4pt 8pt;color:#375623;font-size:9pt;">No critical findings.</td></tr>`
      return `<div style="page-break-inside:avoid;"><table style="width:100%;border-collapse:collapse;margin-bottom:4pt;"><tr><td style="background:#de134d;padding:8pt 12pt;border:none;"><span style="font-size:14pt;font-weight:bold;color:#fff;font-family:Arial;">${r.drawingRef}</span><br><span style="font-size:10pt;color:rgba(255,255,255,0.85);font-family:Arial;">${r.drawingType}</span></td><td style="background:${rb[r.overallRAG]||'#f7f5f1'};padding:8pt 12pt;text-align:right;border:none;width:120pt;"><span style="font-size:12pt;font-weight:bold;color:${rc[r.overallRAG]||'#333'};font-family:Arial;">${rl[r.overallRAG]||r.overallRAG}</span></td></tr></table><table style="width:100%;border-collapse:collapse;margin-bottom:8pt;"><tr><td style="background:#f7f5f1;padding:8pt 12pt;border-left:3pt solid #de134d;font-size:10pt;font-family:Arial;color:#40404c;"><strong>Issue Recommendation:</strong> ${r.issueRecommendation}</td></tr><tr><td style="padding:6pt 12pt;font-size:10pt;font-family:Arial;color:#555;border-top:0.5pt solid #e0ddd7;">${r.summary}</td></tr></table><p style="font-size:10pt;font-weight:bold;color:#40404c;font-family:Arial;margin:8pt 0 4pt;">Critical Findings</p><table style="width:100%;border-collapse:collapse;margin-bottom:12pt;"><tr style="background:#40404c;"><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">#</th><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Phase</th><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Finding</th><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Action</th></tr>${critRows}</table><p style="font-size:10pt;font-weight:bold;color:#40404c;font-family:Arial;margin:8pt 0 4pt;">QA Phase Results</p><table style="width:100%;border-collapse:collapse;margin-bottom:20pt;"><tr style="background:#40404c;"><th colspan="2" style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Phase</th><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Status</th></tr>${phaseRows(r.phases||[])}</table></div>`
    }).join('<br style="page-break-after:always;">')
    const batchRows = reviewed.map(d=>{const r=d.result;return`<tr><td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-weight:bold;font-size:9pt;">${r.drawingRef}</td><td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${r.drawingType}</td><td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-weight:bold;color:${rc[r.overallRAG]||'#333'};background:${rb[r.overallRAG]||'#fff'};font-size:9pt;">${rl[r.overallRAG]||r.overallRAG}</td><td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${r.criticalFindings?.length||0}</td><td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-size:9pt;">${r.issueRecommendation}</td></tr>`}).join('')
    const redC=reviewed.filter(d=>d.result?.overallRAG==='RED').length
    const ambC=reviewed.filter(d=>d.result?.overallRAG==='AMBER').length
    const grnC=reviewed.filter(d=>d.result?.overallRAG==='GREEN').length
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm 2cm;}body{font-family:Arial,sans-serif;font-size:10pt;color:#40404c;margin:0;}h1{font-size:20pt;color:#de134d;margin:0 0 4pt;}h2{font-size:13pt;color:#40404c;border-bottom:1pt solid #de134d;padding-bottom:3pt;margin:16pt 0 6pt;}p{margin:4pt 0;}table{border-collapse:collapse;}th{font-weight:bold;}</style></head><body><table style="width:100%;border-collapse:collapse;margin-bottom:16pt;border-bottom:2pt solid #de134d;"><tr><td style="padding:0 0 8pt;border:none;"><h1>Reds10 Group</h1><p style="font-size:13pt;color:#40404c;margin:0;font-weight:bold;">Drawing QA Report</p></td><td style="text-align:right;vertical-align:bottom;padding:0 0 8pt;border:none;"><p style="font-size:9pt;color:#888;margin:0;">Date: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</p><p style="font-size:9pt;color:#888;margin:0;">Drawings reviewed: ${reviewed.length}</p><p style="font-size:9pt;color:#888;margin:0;"><span style="color:#C00000;font-weight:bold;">${redC} RED</span> &nbsp;<span style="color:#C55A11;font-weight:bold;">${ambC} AMBER</span> &nbsp;<span style="color:#375623;font-weight:bold;">${grnC} GREEN</span></p></td></tr></table><h2>Batch Summary</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20pt;"><tr style="background:#40404c;"><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Drawing Ref</th><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Type</th><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Overall RAG</th><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Critical</th><th style="padding:5pt 8pt;color:#e3ded2;font-size:9pt;text-align:left;border:none;">Verdict</th></tr>${batchRows}</table><h2>Detailed Drawing Reports</h2>${sections}<table style="width:100%;border-collapse:collapse;margin-top:20pt;border-top:1pt solid #e0ddd7;"><tr><td style="padding:8pt 0;font-size:8pt;color:#999;border:none;">Generated by Reds10 Drawing QA | Reds10 Group | ${new Date().toLocaleDateString('en-GB')}</td><td style="text-align:right;padding:8pt 0;font-size:8pt;color:#de134d;font-weight:bold;border:none;">CONFIDENTIAL</td></tr></table></body></html>`
    const blob = new Blob(['\ufeff',html],{type:'application/msword'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Reds10-QA-${new Date().toISOString().slice(0,10)}.doc`; a.click()
  }

  const redCount = drawings.filter(d=>d.result?.overallRAG==='RED').length
  const ambCount = drawings.filter(d=>d.result?.overallRAG==='AMBER').length
  const grnCount = drawings.filter(d=>d.result?.overallRAG==='GREEN').length
  const msgs = messages[selectedId] || []
  const rc = RAG[selected?.result?.overallRAG] || RAG.NA

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f0ede8', fontFamily:"-apple-system,'Segoe UI',sans-serif" }}>

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <div style={{ width:200, background:BRAND.charcoal, display:'flex', flexDirection:'column', flexShrink:0 }}>
        {/* Logo */}
        <div style={{ padding:'12px 12px 10px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <img src={LOGO} alt="Reds10" style={{ height:30, width:'auto', display:'block' }}
            onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }} />
          <div style={{ display:'none', fontSize:14, fontWeight:800, color:BRAND.chalk }}>Reds10</div>
          <div style={{ fontSize:7, color:'rgba(227,222,210,0.35)', letterSpacing:1.2, textTransform:'uppercase', marginTop:5 }}>Drawing QA</div>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          {['review','history'].map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'7px 0', fontSize:8, fontWeight:700,
              letterSpacing:0.5, textTransform:'uppercase', background:'transparent', border:'none', cursor:'pointer',
              color:tab===t?BRAND.chalk:'rgba(227,222,210,0.3)',
              borderBottom:tab===t?`2px solid ${BRAND.red}`:'2px solid transparent' }}>{t}</button>
          ))}
        </div>
        {tab==='review' ? (
          <>
            {/* Drop zone */}
            <div onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files)}}
              onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
              onClick={()=>fileRef.current?.click()}
              style={{ margin:8, border:`1.5px dashed ${dragOver?BRAND.chalk:'rgba(227,222,210,0.2)'}`,
                borderRadius:7, padding:'11px 6px', textAlign:'center', cursor:'pointer',
                background:dragOver?'rgba(255,255,255,0.04)':'transparent' }}>
              <div style={{ fontSize:18, color:'rgba(227,222,210,0.3)', marginBottom:3 }}>+</div>
              <div style={{ fontSize:8, color:'rgba(227,222,210,0.38)', lineHeight:1.6 }}>Drop drawings here<br/>or click to browse</div>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf" style={{ display:'none' }}
                onChange={e=>handleFiles(e.target.files)} />
            </div>
            {/* Drawing list */}
            <div style={{ flex:1, overflowY:'auto', padding:'0 8px 8px' }}>
              {drawings.length===0 && <div style={{ fontSize:8, color:'rgba(227,222,210,0.22)', textAlign:'center', marginTop:12 }}>No drawings loaded</div>}
              {drawings.map(d => (
                <div key={d.id} onClick={()=>{ setSelectedId(d.id); if(d.result) setColView('results'); else setColView('preview') }}
                  style={{ background:selectedId===d.id?'rgba(222,19,77,0.18)':'rgba(255,255,255,0.04)',
                    border:selectedId===d.id?`1.5px solid ${BRAND.red}`:'1.5px solid transparent',
                    borderRadius:6, padding:'7px 9px', cursor:'pointer', marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ fontSize:9, fontWeight:700, color:BRAND.chalk, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:105 }}>
                      {d.result?.drawingRef || d.name}
                    </span>
                    {d.result?.overallRAG && <RAGBadge status={d.result.overallRAG} size="sm" />}
                    {d.loading && <span style={{ fontSize:8, color:'rgba(227,222,210,0.35)', fontStyle:'italic' }}>…</span>}
                  </div>
                  <div style={{ fontSize:8, color:'rgba(227,222,210,0.35)' }}>{d.result?.drawingType || d.fileType || 'Drawing'}</div>
                </div>
              ))}
            </div>
            {/* Stats + export */}
            {drawings.some(d=>d.result) && (
              <>
                <div style={{ padding:'7px 8px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', gap:4 }}>
                  {[['RED',redCount,BRAND.red],['AMB',ambCount,'#ef9f27'],['GRN',grnCount,'#639922']].map(([l,c,col])=>(
                    <div key={l} style={{ flex:1, background:'rgba(255,255,255,0.05)', borderRadius:5, padding:'5px 3px', textAlign:'center' }}>
                      <div style={{ fontSize:14, fontWeight:700, color:col }}>{c}</div>
                      <div style={{ fontSize:7, color:'rgba(227,222,210,0.35)' }}>{l}</div>
                    </div>
                  ))}
                </div>
                <button onClick={exportReport} style={{ margin:'0 8px 8px', background:BRAND.red, color:'#fff', border:'none',
                  borderRadius:6, padding:9, fontSize:9, fontWeight:700, cursor:'pointer' }}>Export QA Report</button>
              </>
            )}
          </>
        ) : (
          <div style={{ flex:1, overflowY:'auto', padding:8 }}>
            {historyList.length===0 && <div style={{ fontSize:8, color:'rgba(227,222,210,0.22)', textAlign:'center', marginTop:12 }}>No history yet</div>}
            {historyList.map((h,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.05)', borderRadius:6, padding:'7px 9px', marginBottom:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                  <span style={{ fontSize:9, fontWeight:600, color:BRAND.chalk, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:115 }}>
                    {h.result?.drawingRef || h.name}
                  </span>
                  <RAGBadge status={h.result?.overallRAG} size="sm" />
                </div>
                <div style={{ fontSize:7, color:'rgba(227,222,210,0.3)' }}>{h.date}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 2x2 GRID ────────────────────────────────────────── */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', overflow:'hidden' }}>

        {/* ── TOP LEFT: Drawing Preview ── */}
        <div style={{ display:'flex', flexDirection:'column', background:'#f0ede8', borderRight:'1px solid #e0ddd7', borderBottom:'1px solid #e0ddd7', overflow:'hidden' }}>
          <div style={{ padding:'8px 14px', borderBottom:'1px solid #e0ddd7', background:'#fafaf8', display:'flex',
            alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:3, height:12, background:BRAND.red, borderRadius:2 }} />
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', color:'#999' }}>Drawing Preview</span>
            </div>
            {selected && <span style={{ fontSize:8, color:'#bbb' }}>{selected.name}</span>}
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:14, overflow:'hidden' }}>
            {!selected ? (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:32, opacity:0.15, marginBottom:8 }}>⬡</div>
                <div style={{ fontSize:11, color:'#bbb' }}>Drop a drawing to begin</div>
              </div>
            ) : selected.previewUrl ? (
              <img src={selected.previewUrl} alt={selected.name}
                style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:3,
                  boxShadow:'0 2px 20px rgba(0,0,0,0.15)', background:'#fff', padding:4 }} />
            ) : (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:32, opacity:0.15, marginBottom:8 }}>📄</div>
                <div style={{ fontSize:11, color:'#bbb' }}>{selected.name}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── TOP RIGHT: QA Report / Phase Selector ── */}
        <div style={{ display:'flex', flexDirection:'column', background:'#fff', borderBottom:'1px solid #e0ddd7', overflow:'hidden' }}>
          <div style={{ padding:'8px 14px', borderBottom:'1px solid #e0ddd7', background:'#fafaf8', display:'flex',
            alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:3, height:12, background:BRAND.red, borderRadius:2 }} />
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', color:'#999' }}>
                {colView==='phases' ? 'Select QA Phases' : 'QA Report'}
              </span>
            </div>
            {selected?.result && <RAGBadge status={selected.result.overallRAG} size="sm" />}
          </div>

          {/* EMPTY */}
          {!selected && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:28, opacity:0.15, marginBottom:8 }}>📋</div>
                <div style={{ fontSize:11, color:'#bbb' }}>Load a drawing to begin QA</div>
              </div>
            </div>
          )}

          {/* PREVIEW STATE */}
          {selected && colView==='preview' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
              <div style={{ width:'100%', maxWidth:340, background:'#f7f5f1', border:'1px solid #e0ddd7', borderRadius:8, overflow:'hidden' }}>
                <div style={{ background:BRAND.charcoal, padding:'7px 14px', fontSize:9, color:BRAND.chalk, letterSpacing:0.5 }}>DRAWING LOADED</div>
                <div style={{ padding:14, display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ width:70, height:80, background:'#fff', border:'1px solid #e0ddd7', borderRadius:3,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                    {selected.previewUrl
                      ? <img src={selected.previewUrl} alt="" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                      : <div style={{ fontSize:24, opacity:0.2 }}>📄</div>}
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, wordBreak:'break-all', marginBottom:4 }}>{selected.name}</div>
                    <div style={{ fontSize:9, color:'#bbb' }}>{selected.fileType?.includes('pdf')?'PDF':selected.fileType?.split('/')[1]?.toUpperCase()||'File'}</div>
                    <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:4, fontSize:9,
                      padding:'2px 8px', background:'#e1f5ee', color:'#0f6e56', borderRadius:10, fontWeight:600 }}>Ready to review</div>
                  </div>
                </div>
              </div>
              <button onClick={()=>setColView('phases')} style={{ background:BRAND.red, color:'#fff', border:'none',
                borderRadius:8, padding:'11px 32px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Select QA phases →
              </button>
            </div>
          )}

          {/* PHASE SELECTOR */}
          {selected && colView==='phases' && (
            <div style={{ flex:1, overflow:'auto', padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:10, color:'#999' }}>Choose which checks to run</span>
                <div style={{ display:'flex', gap:5 }}>
                  <button onClick={()=>setSelectedPhases(new Set(PHASES.map(p=>p[0])))} style={{ fontSize:9, padding:'3px 8px', background:'transparent', border:'1px solid #ddd', borderRadius:5, cursor:'pointer', color:'#666' }}>All</button>
                  <button onClick={()=>setSelectedPhases(new Set())} style={{ fontSize:9, padding:'3px 8px', background:'transparent', border:'1px solid #ddd', borderRadius:5, cursor:'pointer', color:'#666' }}>None</button>
                </div>
              </div>
              {PHASES.map(([num,label]) => {
                const on = selectedPhases.has(num)
                return (
                  <div key={num} onClick={()=>setSelectedPhases(prev=>{ const n=new Set(prev); n.has(num)?n.delete(num):n.add(num); return n })}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                      background:on?'#fff':'#fafaf8', border:`1.5px solid ${on?BRAND.red:'#e8e5e0'}`,
                      borderRadius:7, cursor:'pointer', marginBottom:5 }}>
                    <div style={{ width:20, height:20, borderRadius:5, flexShrink:0, display:'flex', alignItems:'center',
                      justifyContent:'center', background:on?BRAND.red:'transparent', border:on?'none':'2px solid #ccc' }}>
                      {on && <svg width="11" height="9" viewBox="0 0 11 9"><polyline points="1,4.5 4,7.5 10,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontSize:11, color:on?BRAND.charcoal:'#aaa', fontWeight:on?500:400 }}>Phase {num} — {label}</span>
                  </div>
                )
              })}
              {/* Presets */}
              <div style={{ borderTop:'1px solid #e8e5e0', paddingTop:10, marginTop:6, marginBottom:12 }}>
                <div style={{ fontSize:9, fontWeight:600, color:BRAND.charcoal, marginBottom:7 }}>Presets</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {savedPresets.map(p => {
                    const active = [...selectedPhases].sort().join()===p.phases.slice().sort().join()
                    return (
                      <div key={p.name} onClick={()=>setSelectedPhases(new Set(p.phases))}
                        style={{ fontSize:10, padding:'4px 11px', background:'#fff',
                          border:`1.5px solid ${active?BRAND.red:'#e0ddd7'}`, borderRadius:18,
                          color:active?BRAND.red:'#666', cursor:'pointer', fontWeight:active?600:400 }}>{p.name}</div>
                    )
                  })}
                  <div onClick={()=>{ const name=prompt('Preset name?'); if(name) setSavedPresets(prev=>[...prev,{name,phases:[...selectedPhases].sort((a,b)=>a-b)}]) }}
                    style={{ fontSize:10, padding:'4px 11px', background:'#fff', border:'1.5px dashed #ddd', borderRadius:18, color:'#bbb', cursor:'pointer' }}>+ Save</div>
                </div>
              </div>
              <button onClick={()=>selectedPhases.size>0&&runQA(selected,selectedPhases)}
                style={{ width:'100%', background:selectedPhases.size>0?BRAND.red:'#ccc', color:'#fff', border:'none',
                  borderRadius:7, padding:10, fontSize:12, fontWeight:600, cursor:selectedPhases.size>0?'pointer':'default' }}>
                {selectedPhases.size===0 ? 'Select at least one phase' : `Run QA — ${selectedPhases.size} phase${selectedPhases.size>1?'s':''} →`}
              </button>
            </div>
          )}

          {/* RESULTS */}
          {selected && colView==='results' && (
            <>
              {selected.loading && (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:32 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #e8e5e0', borderTopColor:BRAND.red, animation:'spin .8s linear infinite' }} />
                  <div style={{ fontSize:12, color:BRAND.charcoal, fontWeight:500 }}>Running QA analysis…</div>
                  <div style={{ width:'100%', maxWidth:260, background:'#e8e5e0', borderRadius:4, height:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:BRAND.red, borderRadius:4, animation:'progress 2s ease-in-out infinite' }} />
                  </div>
                  <style>{`@keyframes progress{0%{width:10%}50%{width:80%}100%{width:10%}}`}</style>
                </div>
              )}
              {selected.error && !selected.loading && (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <div style={{ fontSize:12, color:BRAND.red }}>Analysis failed — please try again.</div>
                  <button onClick={()=>setColView('phases')} style={{ fontSize:10, padding:'6px 14px', background:BRAND.charcoal, color:BRAND.chalk, border:'none', borderRadius:6, cursor:'pointer' }}>← Change phases</button>
                </div>
              )}
              {selected.result && !selected.loading && (
                <>
                  <div style={{ flex:1, overflow:'auto', padding:'12px 14px' }}>
                    {/* Header */}
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:18, fontWeight:800, color:BRAND.charcoal, lineHeight:1.1 }}>{selected.result.drawingRef}</div>
                      <div style={{ fontSize:10, color:'#999', marginTop:2 }}>{selected.result.drawingType}</div>
                    </div>
                    {/* Summary */}
                    <div style={{ background:'#f7f5f1', borderRadius:6, padding:'8px 10px', fontSize:10, color:'#666', lineHeight:1.55, marginBottom:8 }}>
                      {selected.result.summary}
                    </div>
                    {/* Issue rec */}
                    <div style={{ padding:'8px 10px', borderRadius:6, marginBottom:10, background:rc.bg, border:`1px solid ${rc.border}` }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#aaa', letterSpacing:0.8, textTransform:'uppercase', marginBottom:3 }}>Issue Recommendation</div>
                      <div style={{ fontSize:10, fontWeight:600, color:BRAND.charcoal }}>{selected.result.issueRecommendation}</div>
                    </div>
                    {/* Critical findings */}
                    {selected.result.criticalFindings?.length > 0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:7, fontWeight:700, color:'#aaa', letterSpacing:0.8, textTransform:'uppercase', marginBottom:5 }}>Critical Findings</div>
                        {selected.result.criticalFindings.map((f,i) => (
                          <div key={i} style={{ display:'flex', gap:7, background:'#fdecea', borderRadius:5, padding:'6px 9px', marginBottom:4 }}>
                            <span style={{ fontSize:9, fontWeight:700, color:BRAND.red, minWidth:12 }}>{i+1}</span>
                            <div>
                              <div style={{ fontSize:10, fontWeight:600, color:'#a32d2d', marginBottom:1 }}>{f.finding}</div>
                              <div style={{ fontSize:9, color:'#888' }}>{f.phase} · {f.action}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Phase rows */}
                    <div style={{ fontSize:7, fontWeight:700, color:'#aaa', letterSpacing:0.8, textTransform:'uppercase', marginBottom:5 }}>QA Phases</div>
                    {selected.result.phases?.map(p => <PhaseRow key={p.id} phase={p} />)}
                  </div>
                  <button onClick={()=>setColView('phases')} style={{ margin:'0 14px 10px', background:BRAND.charcoal, color:BRAND.chalk,
                    border:'none', borderRadius:6, padding:9, fontSize:10, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                    ← Change phases & rerun
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* ── BOTTOM LEFT: Issue Map ── */}
        <div style={{ display:'flex', flexDirection:'column', background:'#1a1b2e', borderRight:'1px solid #252638', overflow:'hidden' }}>
          <div style={{ padding:'8px 14px', borderBottom:'1px solid #252638', background:'#14151f', display:'flex',
            alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:3, height:12, background:'#ef9f27', borderRadius:2 }} />
              <span style={{ fontSize:10, fontWeight:600, color:'#aaa' }}>Issue Map</span>
            </div>
            <span style={{ fontSize:8, color:'#444' }}>Markers show finding locations</span>
          </div>
          <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
            {!selected?.result ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:28, opacity:0.1, marginBottom:8 }}>🗺️</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.15)' }}>QA results will appear here</div>
                </div>
              </div>
            ) : selected.previewUrl ? (
              // Show actual drawing image with RAG markers overlaid
              <div style={{ width:'100%', height:'100%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src={selected.previewUrl} alt="Drawing" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', opacity:0.55, filter:'brightness(0.7) contrast(1.2)' }} />
                {/* RAG markers - position them around the image */}
                {selected.result.criticalFindings?.map((f,i) => (
                  <div key={i} title={f.finding} style={{
                    position:'absolute',
                    left:`${25 + (i * 20)}%`, top:`${30 + (i * 15)}%`,
                    width:28, height:28, borderRadius:'50%',
                    background:'rgba(222,19,77,0.9)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:800, color:'#fff',
                    boxShadow:'0 2px 12px rgba(0,0,0,0.5)',
                    border:'2px solid rgba(255,255,255,0.25)',
                    cursor:'pointer', zIndex:10
                  }}>{i+1}</div>
                ))}
                {selected.result.phases?.filter(p=>p.rag==='AMBER').map((p,i) => (
                  <div key={`a${i}`} title={`Phase ${p.id}: ${p.name}`} style={{
                    position:'absolute',
                    left:`${15 + (i * 25)}%`, top:`${60 + (i * 10)}%`,
                    width:24, height:24, borderRadius:'50%',
                    background:'rgba(239,159,39,0.88)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, fontWeight:800, color:'#fff',
                    boxShadow:'0 2px 10px rgba(0,0,0,0.4)',
                    border:'2px solid rgba(255,255,255,0.2)',
                    cursor:'pointer', zIndex:10
                  }}>{i+1}</div>
                ))}
                {/* Legend */}
                <div style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,0.75)', borderRadius:7, padding:'8px 10px' }}>
                  {[['#de134d','RED — Critical'],['#ef9f27','AMBER — Review'],['#639922','GREEN — Pass']].map(([col,lbl])=>(
                    <div key={lbl} style={{ display:'flex', alignItems:'center', gap:6, fontSize:8, color:'#aaa', marginBottom:4 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:col, flexShrink:0 }} />{lbl}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)' }}>No image available for issue mapping</div>
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM RIGHT: Claude-style Chat ── */}
        <div style={{ display:'flex', flexDirection:'column', background:'#fff', overflow:'hidden' }}>
          {/* Chat header */}
          <div style={{ padding:'9px 14px', borderBottom:'1px solid #eee', background:'#fafaf8', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <div style={{ width:4, height:16, background:BRAND.red, borderRadius:2 }} />
            <span style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, flex:1 }}>
              {selected?.result ? `Chat — ${selected.result.drawingRef}` : 'Chat'}
            </span>
            {selected?.result && <RAGBadge status={selected.result.overallRAG} size="sm" />}
          </div>

          {/* Quick action pills */}
          {selected?.result && (
            <div style={{ padding:'7px 10px', borderBottom:'1px solid #f0ede8', display:'flex', gap:5, flexWrap:'wrap', flexShrink:0, background:'#fafaf8' }}>
              {QUICK_ACTIONS.map(qa => (
                <button key={qa.label} onClick={()=>sendChat(qa.label)}
                  style={{ fontSize:9, fontWeight:600, padding:'3px 9px', borderRadius:13,
                    border:'1px solid #e0ddd7', background:'#fff', color:'#666', cursor:'pointer',
                    whiteSpace:'nowrap', transition:'all 0.15s' }}
                  onMouseEnter={e=>{ e.target.style.borderColor=BRAND.red; e.target.style.color=BRAND.red }}
                  onMouseLeave={e=>{ e.target.style.borderColor='#e0ddd7'; e.target.style.color='#666' }}>
                  {qa.icon} {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
            {msgs.length===0 && (
              <div style={{ fontSize:10, color:'#ccc', textAlign:'center', marginTop:16 }}>
                {selected?.result ? 'Ask anything about this drawing, or use the quick actions above' : 'Complete a QA review to start chatting'}
              </div>
            )}
            {msgs.map((m,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-end', gap:7, flexDirection:m.role==='user'?'row-reverse':'row' }}>
                {/* Avatar */}
                <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:9, fontWeight:700,
                  background:m.role==='user'?BRAND.charcoal:BRAND.red, color:'#fff' }}>
                  {m.role==='user' ? 'S' : 'R'}
                </div>
                {/* Bubble */}
                <div style={{ maxWidth:'80%', fontSize:11, lineHeight:1.6, padding:'8px 12px',
                  borderRadius:m.role==='user'?'13px 13px 3px 13px':'13px 13px 13px 3px',
                  background:m.role==='user'?BRAND.charcoal:'#f0ede8',
                  color:m.role==='user'?BRAND.chalk:BRAND.charcoal }}>
                  {m.role==='assistant' ? <MarkdownText text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {/* Streaming response */}
            {streamingText && (
              <div style={{ display:'flex', alignItems:'flex-end', gap:7 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:9, fontWeight:700, background:BRAND.red, color:'#fff' }}>R</div>
                <div style={{ maxWidth:'80%', fontSize:11, lineHeight:1.6, padding:'8px 12px',
                  borderRadius:'13px 13px 13px 3px', background:'#f0ede8', color:BRAND.charcoal }}>
                  <MarkdownText text={streamingText} />
                  <span style={{ display:'inline-block', width:2, height:12, background:BRAND.red, marginLeft:2, verticalAlign:'middle',
                    animation:'blink 1s infinite' }} />
                </div>
              </div>
            )}
            {/* Typing indicator (before first token) */}
            {chatLoading && !streamingText && (
              <div style={{ display:'flex', alignItems:'flex-end', gap:7 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:BRAND.red, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }}>R</div>
                <div style={{ padding:'10px 14px', borderRadius:'13px 13px 13px 3px', background:'#f0ede8', display:'flex', gap:4 }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#ccc', animation:`dp 1.2s ${i*0.2}s infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={chatBottom} />
          </div>

          {/* Input area */}
          <div style={{ padding:'8px 10px', borderTop:'1px solid #eee', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:8, background:'#f7f5f1',
              border:`1.5px solid #e0ddd7`, borderRadius:12, padding:'7px 10px',
              transition:'border-color 0.15s' }}
              onFocusCapture={e=>e.currentTarget.style.borderColor=BRAND.red}
              onBlurCapture={e=>e.currentTarget.style.borderColor='#e0ddd7'}>
              {/* Attach button */}
              <button title="Attach file" style={{ width:26, height:26, borderRadius:6, border:'none', background:'transparent',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#aaa',
                flexShrink:0 }}>📎</button>
              <textarea ref={chatRef} value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendChat() }}}
                placeholder={selected?.result ? 'Ask about this drawing, request an RFI, check compliance…' : 'Complete a QA review first…'}
                disabled={!selected?.result || chatLoading}
                rows={1} style={{ flex:1, border:'none', background:'transparent', fontSize:11,
                  color:BRAND.charcoal, outline:'none', resize:'none', fontFamily:'inherit',
                  lineHeight:1.5, minHeight:20, maxHeight:72 }} />
              <button onClick={()=>sendChat()} disabled={!selected?.result||!chatInput.trim()||chatLoading}
                style={{ width:28, height:28, borderRadius:8, border:'none', flexShrink:0,
                  background:selected?.result&&chatInput.trim()&&!chatLoading?BRAND.red:'#ddd',
                  color:'#fff', cursor:selected?.result&&chatInput.trim()&&!chatLoading?'pointer':'default',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>↑</button>
            </div>
            <div style={{ fontSize:8, color:'#bbb', textAlign:'center', marginTop:4 }}>
              📎 attach spec · Enter to send · Shift+Enter new line
            </div>
          </div>
        </div>

      </div>{/* end grid */}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes dp { 0%,100%{opacity:.25;transform:scale(0.85)}50%{opacity:1;transform:scale(1)} }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }
      `}</style>
    </div>
  )
}
