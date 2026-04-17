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
  const fileRef = useRef()
  const chatBottomRef = useRef()
  const selected = drawings.find(d => d.id === selectedId)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, selectedId])

  const analyseDrawing = useCallback(async (drawing, b64, mtype) => {
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
        headers: { 'Content-Type': 'application/json', 'anthropic-dangerous-direct-browser-calls': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: SYSTEM_PROMPT, messages }),
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
      const drawing = { id, name: file.name, fileType: file.type, previewUrl, loading: false, error: false, result: null }
      setDrawings(prev => [...prev, drawing])
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const reader = new FileReader()
        reader.onload = e => analyseDrawing(drawing, e.target.result.split(',')[1], file.type)
        reader.readAsDataURL(file)
      } else {
        analyseDrawing(drawing, null, null)
      }
    })
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
        headers: { 'Content-Type': 'application/json', 'anthropic-dangerous-direct-browser-calls': 'true' },
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
    const lines = drawings.filter(d => d.result).map(d => {
      const r = d.result
      const cf = r.criticalFindings?.map((f, i) => `  ${i + 1}. [${f.phase}] ${f.finding} → ${f.action}`).join('\n') || '  None'
      return `DRAWING: ${r.drawingRef}\nType: ${r.drawingType}\nRAG: ${r.overallRAG}\nVerdict: ${r.issueRecommendation}\nCritical Findings:\n${cf}`
    }).join('\n\n---\n\n')
    const blob = new Blob([`REDS10 DRAWING QA REPORT\nDate: ${new Date().toLocaleDateString('en-GB')}\n\n${'='.repeat(50)}\n\n${lines}`], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Reds10-Drawing-QA-${new Date().toISOString().slice(0, 10)}.txt`
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

      {/* ── COL 2: PDF / Image Viewer ── */}
      <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e0ddd7', background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e8e5e0', background: '#fff', fontSize: 11, fontWeight: 600, color: BRAND.charcoal, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? (selected.result?.drawingRef || selected.name) : 'Drawing Viewer'}
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#f0ede8', display: 'flex', alignItems: selected?.previewUrl ? 'flex-start' : 'center', justifyContent: 'center', padding: selected?.previewUrl ? 0 : 20 }}>
          {!selected ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>⬡</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>Select a drawing to view</div>
            </div>
          ) : selected.loading ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${BRAND.chalk}`, borderTopColor: BRAND.red, animation: 'spin .8s linear infinite', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 12, color: '#aaa' }}>Analysing…</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : selected.previewUrl && selected.fileType === 'application/pdf' ? (
            <iframe src={selected.previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={selected.name} />
          ) : selected.previewUrl ? (
            <img src={selected.previewUrl} alt={selected.name} style={{ maxWidth: '100%', display: 'block' }} />
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 12, color: '#aaa' }}>Preview not available for this file type</div>
            </div>
          )}
        </div>
      </div>

      {/* ── COL 3: QA Results + Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* QA Results — top half */}
        <div style={{ flex: '0 0 55%', overflowY: 'auto', borderBottom: '1px solid #e0ddd7' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: 12, color: '#ccc' }}>No drawing selected</div>
            </div>
          ) : selected.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${BRAND.chalk}`, borderTopColor: BRAND.red, animation: 'spin .8s linear infinite' }} />
              <div style={{ fontSize: 11, color: '#bbb' }}>Running QA…</div>
            </div>
          ) : selected.error ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: 12, color: BRAND.red }}>Analysis failed — please try again.</div>
            </div>
          ) : selected.result ? (
            <div style={{ padding: '14px 16px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.charcoal, marginBottom: 1 }}>{selected.result.drawingRef}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{selected.result.drawingType}</div>
                </div>
                <RAGBadge status={selected.result.overallRAG} />
              </div>

              {/* Summary */}
              <div style={{ background: '#f7f5f1', borderRadius: 7, padding: '8px 11px', marginBottom: 10, fontSize: 11, color: '#555', lineHeight: 1.6 }}>{selected.result.summary}</div>

              {/* Verdict */}
              <div style={{ background: rc.bg, borderRadius: 7, padding: '8px 11px', marginBottom: 10, border: `1px solid ${rc.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: '#aaa', marginBottom: 3, textTransform: 'uppercase' }}>Issue Recommendation</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.charcoal }}>{selected.result.issueRecommendation}</div>
              </div>

              {/* Critical findings */}
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

              {/* Phases */}
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: '#aaa', marginBottom: 6, textTransform: 'uppercase' }}>QA Phases</div>
              <div style={{ border: '1px solid #e8e5e0', borderRadius: 7, overflow: 'hidden' }}>
                {selected.result.phases?.map(p => <PhaseRow key={p.id} phase={p} />)}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: 12, color: '#ccc' }}>Upload a drawing to begin</div>
            </div>
          )}
        </div>

        {/* Chat — bottom half */}
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
      <style>{`@keyframes dp{0%,100%{opacity:.25}50%{opacity:1}}`}</style>
    </div>
  )
}

