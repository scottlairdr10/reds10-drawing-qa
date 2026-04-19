import { useState, useEffect, useRef, useCallback } from 'react'
import { BRAND, PHASES, PRESETS, QUICK_ACTIONS, RAG } from '../shared/constants'
import { RAGBadge } from '../shared/ui'
import { API_URL, getHeaders } from '../shared/constants'
import { streamChat } from '../shared/qa-api'

// Markdown renderer for chat
function MarkdownText({ text }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize:11, lineHeight:1.65, color:BRAND.charcoal }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, marginTop:6, marginBottom:2 }}>{line.slice(4)}</div>
        if (line.startsWith('## ')) return <div key={i} style={{ fontSize:12, fontWeight:800, color:BRAND.charcoal, marginTop:8, marginBottom:3 }}>{line.slice(3)}</div>
        if (line.startsWith('# ')) return <div key={i} style={{ fontSize:13, fontWeight:800, color:BRAND.charcoal, marginTop:8, marginBottom:4 }}>{line.slice(2)}</div>
        if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
          return <div key={i} style={{ display:'flex', gap:6, marginTop:2 }}>
            <span style={{ color:BRAND.red, fontWeight:700, flexShrink:0 }}>·</span>
            <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`(.*?)`/g,'<code style="background:#f0ede8;padding:1px 4px;border-radius:3px;font-size:10px;">$1</code>') }} />
          </div>
        }
        if (line.trim() === '') return <div key={i} style={{ height:6 }} />
        return <div key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`(.*?)`/g,'<code style="background:#f0ede8;padding:1px 4px;border-radius:3px;font-size:10px;">$1</code>') }} />
      })}
    </div>
  )
}

function PhaseRow({ phase }) {
  const [open, setOpen] = useState(false)
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

export default function ReviewPage({ drawing, onBack, onUpdateDrawing, onRunQA }) {
  const [colView, setColView] = useState(drawing?.result ? 'results' : (drawing?.fileObj || drawing?.previewUrl ? 'preview' : 'preview'))
  const [selectedPhases, setSelectedPhases] = useState(new Set(drawing?.phasesRun || [1,2,3,6,8]))
  const [savedPresets, setSavedPresets] = useState(PRESETS)
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const chatBottom = useRef()

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, streamingText])

  const rc = RAG[drawing?.result?.overallRAG] || RAG.NA

  const sendChat = useCallback(async (inputText) => {
    const text = inputText || chatInput.trim()
    if (!text || !drawing?.result) return
    setChatInput('')
    const updated = [...messages, { role:'user', content:text }]
    setMessages(updated)
    setChatLoading(true)
    setStreamingText('')

    let userContent = text
    if (drawing.fileObj && drawing.fileObj.type.startsWith('image/')) {
      const b64 = await new Promise(resolve => {
        const r = new FileReader()
        r.onload = e => resolve(e.target.result.split(',')[1])
        r.readAsDataURL(drawing.fileObj)
      })
      userContent = [
        { type:'image', source:{ type:'base64', media_type:drawing.fileObj.type, data:b64 } },
        { type:'text', text }
      ]
    }

    const apiMessages = messages.map(m => ({ role:m.role, content:m.content }))
    apiMessages.push({ role:'user', content:userContent })

    const system = `You are a specialist drawing QA expert for Reds10 Group. You have access to the drawing image and the full QA result below.
Drawing: ${drawing.result?.drawingRef || drawing.name}
Type: ${drawing.result?.drawingType || 'Unknown'}
Overall RAG: ${drawing.result?.overallRAG}
QA Summary: ${drawing.result?.summary}
Issue Recommendation: ${drawing.result?.issueRecommendation}
Critical Findings: ${JSON.stringify(drawing.result?.criticalFindings)}
Phase Results: ${JSON.stringify(drawing.result?.phases)}

Answer questions concisely and professionally. Use **bold** for emphasis. Use bullet points for lists. Reference phase numbers and specific findings when relevant. Format with markdown headings (## for sections, ### for subsections) where appropriate.`

    await streamChat({
      system, messages: apiMessages,
      onToken: (t) => setStreamingText(t),
      onDone: (fullText) => {
        setMessages(m => [...m, { role:'assistant', content:fullText }])
        setStreamingText('')
        setChatLoading(false)
      },
      onError: (e) => {
        console.error('chat error', e)
        setMessages(m => [...m, { role:'assistant', content:'Error — please try again.' }])
        setStreamingText('')
        setChatLoading(false)
      }
    })
  }, [chatInput, messages, drawing])

  if (!drawing) {
    return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f2ee' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:32, opacity:0.2, marginBottom:10 }}>⬡</div>
          <div style={{ fontSize:12, color:'#bbb' }}>No drawing selected</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f4f2ee', overflow:'hidden' }}>
      {/* Topbar with back button */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e0ddd7', padding:'0 20px', height:44,
        display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:'transparent', border:'none', cursor:'pointer',
          fontSize:11, color:'#666', display:'flex', alignItems:'center', gap:4 }}>
          ← Back
        </button>
        <div style={{ width:1, height:16, background:'#e8e5e0' }} />
        <div style={{ fontSize:12, fontWeight:700, color:BRAND.charcoal }}>
          {drawing.result?.drawingRef || drawing.name}
        </div>
        {drawing.result && <RAGBadge status={drawing.result.overallRAG} size="sm" />}
      </div>

      {/* 2x2 Grid */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', overflow:'hidden' }}>

        {/* TOP LEFT: Drawing Preview */}
        <div style={{ display:'flex', flexDirection:'column', background:'#f0ede8',
          borderRight:'1px solid #e0ddd7', borderBottom:'1px solid #e0ddd7', overflow:'hidden' }}>
          <div style={{ padding:'8px 14px', borderBottom:'1px solid #e0ddd7', background:'#fafaf8',
            display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:3, height:12, background:BRAND.red, borderRadius:2 }} />
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', color:'#999' }}>Drawing Preview</span>
            </div>
            <span style={{ fontSize:8, color:'#bbb' }}>{drawing.name}</span>
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:14, overflow:'hidden' }}>
            {drawing.previewUrl ? (
              <img src={drawing.previewUrl} alt={drawing.name}
                style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:3,
                  boxShadow:'0 2px 20px rgba(0,0,0,0.15)', background:'#fff', padding:4 }} />
            ) : (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:32, opacity:0.15, marginBottom:8 }}>📄</div>
                <div style={{ fontSize:11, color:'#bbb' }}>{drawing.name}</div>
              </div>
            )}
          </div>
        </div>

        {/* TOP RIGHT: QA Report / Phase Selector */}
        <div style={{ display:'flex', flexDirection:'column', background:'#fff', borderBottom:'1px solid #e0ddd7', overflow:'hidden' }}>
          <div style={{ padding:'8px 14px', borderBottom:'1px solid #e0ddd7', background:'#fafaf8',
            display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:3, height:12, background:BRAND.red, borderRadius:2 }} />
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', color:'#999' }}>
                {colView==='phases' ? 'Select QA Phases' : 'QA Report'}
              </span>
            </div>
            {drawing.result && <RAGBadge status={drawing.result.overallRAG} size="sm" />}
          </div>

          {/* Preview state */}
          {colView==='preview' && !drawing.result && !drawing.loading && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
              <div style={{ width:'100%', maxWidth:340, background:'#f7f5f1', border:'1px solid #e0ddd7', borderRadius:8, overflow:'hidden' }}>
                <div style={{ background:BRAND.charcoal, padding:'7px 14px', fontSize:9, color:BRAND.chalk, letterSpacing:0.5 }}>DRAWING LOADED</div>
                <div style={{ padding:14, display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ width:70, height:80, background:'#fff', border:'1px solid #e0ddd7', borderRadius:3,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                    {drawing.previewUrl
                      ? <img src={drawing.previewUrl} alt="" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                      : <div style={{ fontSize:24, opacity:0.2 }}>📄</div>}
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, wordBreak:'break-all', marginBottom:4 }}>{drawing.name}</div>
                    <div style={{ fontSize:9, color:'#bbb' }}>{drawing.fileType?.includes('pdf')?'PDF':drawing.fileType?.split('/')[1]?.toUpperCase()||'File'}</div>
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

          {/* Phase selector */}
          {colView==='phases' && (
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
                </div>
              </div>
              <button onClick={()=>{ if(selectedPhases.size>0){ setColView('results'); onRunQA(drawing, selectedPhases) }}}
                style={{ width:'100%', background:selectedPhases.size>0?BRAND.red:'#ccc', color:'#fff', border:'none',
                  borderRadius:7, padding:10, fontSize:12, fontWeight:600, cursor:selectedPhases.size>0?'pointer':'default' }}>
                {selectedPhases.size===0 ? 'Select at least one phase' : `Run QA — ${selectedPhases.size} phase${selectedPhases.size>1?'s':''} →`}
              </button>
            </div>
          )}

          {/* Results */}
          {colView==='results' && (
            <>
              {drawing.loading && (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:32 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #e8e5e0', borderTopColor:BRAND.red, animation:'spin .8s linear infinite' }} />
                  <div style={{ fontSize:12, color:BRAND.charcoal, fontWeight:500 }}>Running QA analysis…</div>
                </div>
              )}
              {drawing.error && !drawing.loading && (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <div style={{ fontSize:12, color:BRAND.red }}>Analysis failed — please try again.</div>
                  <button onClick={()=>setColView('phases')} style={{ fontSize:10, padding:'6px 14px', background:BRAND.charcoal, color:BRAND.chalk, border:'none', borderRadius:6, cursor:'pointer' }}>← Change phases</button>
                </div>
              )}
              {drawing.result && !drawing.loading && (
                <>
                  <div style={{ flex:1, overflow:'auto', padding:'12px 14px' }}>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:18, fontWeight:800, color:BRAND.charcoal, lineHeight:1.1 }}>{drawing.result.drawingRef}</div>
                      <div style={{ fontSize:10, color:'#999', marginTop:2 }}>{drawing.result.drawingType}</div>
                    </div>
                    <div style={{ background:'#f7f5f1', borderRadius:6, padding:'8px 10px', fontSize:10, color:'#666', lineHeight:1.55, marginBottom:8 }}>
                      {drawing.result.summary}
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:6, marginBottom:10, background:rc.bg, border:`1px solid ${rc.border}` }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#aaa', letterSpacing:0.8, textTransform:'uppercase', marginBottom:3 }}>Issue Recommendation</div>
                      <div style={{ fontSize:10, fontWeight:600, color:BRAND.charcoal }}>{drawing.result.issueRecommendation}</div>
                    </div>
                    {drawing.result.criticalFindings?.length > 0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:7, fontWeight:700, color:'#aaa', letterSpacing:0.8, textTransform:'uppercase', marginBottom:5 }}>Critical Findings</div>
                        {drawing.result.criticalFindings.map((f,i) => (
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
                    <div style={{ fontSize:7, fontWeight:700, color:'#aaa', letterSpacing:0.8, textTransform:'uppercase', marginBottom:5 }}>QA Phases</div>
                    {drawing.result.phases?.map(p => <PhaseRow key={p.id} phase={p} />)}
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

        {/* BOTTOM LEFT: Issue Map */}
        <div style={{ display:'flex', flexDirection:'column', background:'#1a1b2e', borderRight:'1px solid #252638', overflow:'hidden' }}>
          <div style={{ padding:'8px 14px', borderBottom:'1px solid #252638', background:'#14151f',
            display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:3, height:12, background:'#ef9f27', borderRadius:2 }} />
              <span style={{ fontSize:10, fontWeight:600, color:'#aaa' }}>Issue Map</span>
            </div>
            <span style={{ fontSize:8, color:'#444' }}>Markers show finding locations</span>
          </div>
          <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
            {!drawing.result ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:28, opacity:0.1, marginBottom:8 }}>🗺️</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.15)' }}>QA results will appear here</div>
                </div>
              </div>
            ) : drawing.previewUrl ? (
              <div style={{ width:'100%', height:'100%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src={drawing.previewUrl} alt="Drawing" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', opacity:0.55, filter:'brightness(0.7) contrast(1.2)' }} />
                {drawing.result.criticalFindings?.map((f,i) => (
                  <div key={i} title={f.finding} style={{
                    position:'absolute', left:`${25 + (i * 20)}%`, top:`${30 + (i * 15)}%`,
                    width:28, height:28, borderRadius:'50%', background:'rgba(222,19,77,0.9)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:800, color:'#fff',
                    boxShadow:'0 2px 12px rgba(0,0,0,0.5)', border:'2px solid rgba(255,255,255,0.25)',
                    cursor:'pointer', zIndex:10
                  }}>{i+1}</div>
                ))}
                {drawing.result.phases?.filter(p=>p.rag==='AMBER').map((p,i) => (
                  <div key={`a${i}`} title={`Phase ${p.id}: ${p.name}`} style={{
                    position:'absolute', left:`${15 + (i * 25)}%`, top:`${60 + (i * 10)}%`,
                    width:24, height:24, borderRadius:'50%', background:'rgba(239,159,39,0.88)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, fontWeight:800, color:'#fff',
                    boxShadow:'0 2px 10px rgba(0,0,0,0.4)', border:'2px solid rgba(255,255,255,0.2)',
                    cursor:'pointer', zIndex:10
                  }}>{i+1}</div>
                ))}
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

        {/* BOTTOM RIGHT: Chat */}
        <div style={{ display:'flex', flexDirection:'column', background:'#fff', overflow:'hidden' }}>
          <div style={{ padding:'9px 14px', borderBottom:'1px solid #eee', background:'#fafaf8',
            display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <div style={{ width:4, height:16, background:BRAND.red, borderRadius:2 }} />
            <span style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, flex:1 }}>
              {drawing.result ? `Chat — ${drawing.result.drawingRef}` : 'Chat'}
            </span>
            {drawing.result && <RAGBadge status={drawing.result.overallRAG} size="sm" />}
          </div>

          {drawing.result && (
            <div style={{ padding:'7px 10px', borderBottom:'1px solid #f0ede8',
              display:'flex', gap:5, flexWrap:'wrap', flexShrink:0, background:'#fafaf8' }}>
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

          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
            {messages.length===0 && (
              <div style={{ fontSize:10, color:'#ccc', textAlign:'center', marginTop:16 }}>
                {drawing.result ? 'Ask anything about this drawing, or use the quick actions above' : 'Complete a QA review to start chatting'}
              </div>
            )}
            {messages.map((m,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-end', gap:7, flexDirection:m.role==='user'?'row-reverse':'row' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:9, fontWeight:700,
                  background:m.role==='user'?BRAND.charcoal:BRAND.red, color:'#fff' }}>
                  {m.role==='user' ? 'S' : 'R'}
                </div>
                <div style={{ maxWidth:'80%', fontSize:11, lineHeight:1.6, padding:'8px 12px',
                  borderRadius:m.role==='user'?'13px 13px 3px 13px':'13px 13px 13px 3px',
                  background:m.role==='user'?BRAND.charcoal:'#f0ede8',
                  color:m.role==='user'?BRAND.chalk:BRAND.charcoal }}>
                  {m.role==='assistant' ? <MarkdownText text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {streamingText && (
              <div style={{ display:'flex', alignItems:'flex-end', gap:7 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:9, fontWeight:700, background:BRAND.red, color:'#fff' }}>R</div>
                <div style={{ maxWidth:'80%', fontSize:11, lineHeight:1.6, padding:'8px 12px',
                  borderRadius:'13px 13px 13px 3px', background:'#f0ede8', color:BRAND.charcoal }}>
                  <MarkdownText text={streamingText} />
                  <span style={{ display:'inline-block', width:2, height:12, background:BRAND.red, marginLeft:2, verticalAlign:'middle', animation:'blink 1s infinite' }} />
                </div>
              </div>
            )}
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

          <div style={{ padding:'8px 10px', borderTop:'1px solid #eee', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:8, background:'#f7f5f1',
              border:`1.5px solid #e0ddd7`, borderRadius:12, padding:'7px 10px' }}>
              <button title="Attach file" style={{ width:26, height:26, borderRadius:6, border:'none',
                background:'transparent', cursor:'pointer', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:14, color:'#aaa', flexShrink:0 }}>📎</button>
              <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendChat() }}}
                placeholder={drawing.result ? 'Ask about this drawing, request an RFI, check compliance…' : 'Complete a QA review first…'}
                disabled={!drawing.result || chatLoading}
                rows={1} style={{ flex:1, border:'none', background:'transparent', fontSize:11,
                  color:BRAND.charcoal, outline:'none', resize:'none', fontFamily:'inherit',
                  lineHeight:1.5, minHeight:20, maxHeight:72 }} />
              <button onClick={()=>sendChat()} disabled={!drawing.result||!chatInput.trim()||chatLoading}
                style={{ width:28, height:28, borderRadius:8, border:'none', flexShrink:0,
                  background:drawing.result&&chatInput.trim()&&!chatLoading?BRAND.red:'#ddd',
                  color:'#fff', cursor:drawing.result&&chatInput.trim()&&!chatLoading?'pointer':'default',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>↑</button>
            </div>
          </div>
        </div>

      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes dp { 0%,100%{opacity:.25;transform:scale(0.85)}50%{opacity:1;transform:scale(1)} }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }
      `}</style>
    </div>
  )
}
