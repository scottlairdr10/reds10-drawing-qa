import { useRef } from 'react'
import { BRAND } from '../shared/constants'
import { RAGBadge } from '../shared/ui'
import { timeAgo } from '../shared/constants'

export default function Dashboard({ drawings, projects, onOpenDrawing, onOpenProject, onNewReview, onAddFiles }) {
  const fileRef = useRef()
  const recent = [...drawings].filter(d => d.result).sort((a,b) => new Date(b.reviewedAt) - new Date(a.reviewedAt)).slice(0, 6)
  const redC = drawings.filter(d=>d.result?.overallRAG==='RED').length
  const ambC = drawings.filter(d=>d.result?.overallRAG==='AMBER').length
  const grnC = drawings.filter(d=>d.result?.overallRAG==='GREEN').length
  const total = drawings.filter(d=>d.result).length

  // Phase pass rate calculation
  const phasePassRate = (id) => {
    const all = drawings.filter(d=>d.result).flatMap(d=>d.result.phases||[]).filter(p=>p.id===id&&p.rag!=='NA')
    if (!all.length) return 0
    const green = all.filter(p=>p.rag==='GREEN').length
    return Math.round((green/all.length)*100)
  }
  const passColor = pct => pct >= 70 ? '#639922' : pct >= 50 ? '#ef9f27' : '#de134d'

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f4f2ee', overflow:'hidden' }}>
      {/* Topbar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e0ddd7', padding:'0 24px', height:52,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontSize:16, fontWeight:800, color:BRAND.charcoal }}>Dashboard</div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f4f2ee',
            border:'1.5px solid #e0ddd7', borderRadius:7, padding:'6px 12px', fontSize:11, color:'#999', width:180 }}>
            🔍 Search drawings…
          </div>
          <button onClick={onNewReview} style={{ background:BRAND.red, color:'#fff', border:'none', borderRadius:7,
            padding:'8px 16px', fontSize:11, fontWeight:700, cursor:'pointer' }}>+ New Review</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Total Reviews', num: total, color: BRAND.charcoal, sub: total === 0 ? 'Get started below' : `${drawings.length} drawings loaded` },
            { label:'RED — Critical', num: redC, color:'#de134d', sub: redC === 0 ? 'None yet' : 'Require action' },
            { label:'AMBER — Review', num: ambC, color:'#ef9f27', sub: ambC === 0 ? 'None yet' : 'Revision needed' },
            { label:'GREEN — Ready', num: grnC, color:'#639922', sub: grnC === 0 ? 'None yet' : 'Ready to issue' },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', borderRadius:10, padding:'16px 18px', border:'1px solid #e8e5e0' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#aaa', letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1, marginBottom:4 }}>{s.num}</div>
              <div style={{ fontSize:10, color:'#bbb' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Two column */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:16 }}>

          {/* LEFT: Drop zone + recent */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Drop zone */}
            <div onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); onAddFiles(e.dataTransfer.files) }}
              onDragOver={e => e.preventDefault()}
              style={{ background:'#fff', borderRadius:10, border:'2px dashed #e0ddd7', padding:'28px 20px',
                textAlign:'center', cursor:'pointer', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=BRAND.red; e.currentTarget.style.background='#fff8fa' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#e0ddd7'; e.currentTarget.style.background='#fff' }}>
              <div style={{ fontSize:28, marginBottom:10, opacity:0.5 }}>⬆️</div>
              <div style={{ fontSize:13, fontWeight:700, color:BRAND.charcoal, marginBottom:4 }}>
                Drop drawings here to start a new QA review
              </div>
              <div style={{ fontSize:10, color:'#bbb', lineHeight:1.5 }}>
                Supports PNG, JPG and PDF · Batch upload multiple drawings<br/>
                Results in seconds · Export as Word report
              </div>
              <button onClick={(e)=>{ e.stopPropagation(); fileRef.current?.click() }}
                style={{ display:'inline-flex', alignItems:'center', gap:6, background:BRAND.red, color:'#fff',
                  border:'none', borderRadius:7, padding:'8px 18px', fontSize:11, fontWeight:700, cursor:'pointer', marginTop:12 }}>
                📂 Browse files
              </button>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf" style={{ display:'none' }}
                onChange={e => onAddFiles(e.target.files)} />
            </div>

            {/* Recent reviews table */}
            <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e8e5e0', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f0ede8', display:'flex',
                alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:3, height:13, background:BRAND.red, borderRadius:2 }} />
                  Recent Reviews
                </div>
              </div>
              {recent.length === 0 ? (
                <div style={{ padding:'32px 20px', textAlign:'center', color:'#bbb', fontSize:11 }}>
                  No reviews yet — drop a drawing above to get started
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Drawing','Project','Phases','RAG','Reviewed',''].map(h => (
                        <th key={h} style={{ fontSize:8, fontWeight:700, color:'#aaa', letterSpacing:0.8, textTransform:'uppercase',
                          padding:'8px 14px', borderBottom:'1px solid #f0ede8', textAlign:'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(d => (
                      <tr key={d.id} onClick={() => onOpenDrawing(d.id)}
                        onMouseEnter={e => e.currentTarget.style.background='#fafaf8'}
                        onMouseLeave={e => e.currentTarget.style.background=''}
                        style={{ cursor:'pointer' }}>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid #f8f6f3' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal }}>{d.result.drawingRef}</div>
                          <div style={{ fontSize:9, color:'#bbb', marginTop:1 }}>{d.result.drawingType}</div>
                        </td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid #f8f6f3', fontSize:10, color:'#666' }}>{d.project || '—'}</td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid #f8f6f3', fontSize:10, color:'#666' }}>
                          {d.phasesRun?.length === 8 ? 'Full check' : `${d.phasesRun?.length || 0} phases`}
                        </td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid #f8f6f3' }}>
                          <RAGBadge status={d.result.overallRAG} size="sm" />
                        </td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid #f8f6f3', fontSize:10, color:'#bbb' }}>{timeAgo(d.reviewedAt)}</td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid #f8f6f3', color:BRAND.red, fontSize:11, fontWeight:600 }}>Open →</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT: breakdown + phase health */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* RAG breakdown */}
            <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e8e5e0', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f0ede8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:3, height:13, background:BRAND.red, borderRadius:2 }} />RAG Breakdown
                </div>
                <span style={{ fontSize:9, color:'#bbb' }}>{total} reviews</span>
              </div>
              <div style={{ padding:'14px 16px' }}>
                {total === 0 ? (
                  <div style={{ textAlign:'center', color:'#bbb', fontSize:10, padding:'16px 0' }}>No data yet</div>
                ) : (
                  <>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:80, marginBottom:8 }}>
                      {[['RED',redC,'#de134d','#fdecea'],['AMBER',ambC,'#ef9f27','#fef6e4'],['GREEN',grnC,'#639922','#eaf3de']].map(([l,c,col,bg])=>(
                        <div key={l} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:col }}>{c}</div>
                          <div style={{ width:'100%', background:bg, borderRadius:'4px 4px 0 0',
                            height:Math.max(4, (c/Math.max(1,total))*72), borderTop:`3px solid ${col}` }} />
                          <div style={{ fontSize:8, color:'#aaa' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background:'#f7f5f1', borderRadius:6, padding:'8px 10px', fontSize:10, color:'#666', textAlign:'center' }}>
                      <strong style={{ color:'#639922' }}>{Math.round((grnC/total)*100)}%</strong> ready &nbsp;·&nbsp;
                      <strong style={{ color:'#ef9f27' }}>{Math.round((ambC/total)*100)}%</strong> revise &nbsp;·&nbsp;
                      <strong style={{ color:'#de134d' }}>{Math.round((redC/total)*100)}%</strong> critical
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Phase pass rate */}
            <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e8e5e0', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f0ede8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:11, fontWeight:700, color:BRAND.charcoal, display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:3, height:13, background:BRAND.red, borderRadius:2 }} />Phase Pass Rate
                </div>
              </div>
              <div style={{ padding:'12px 16px' }}>
                {total === 0 ? (
                  <div style={{ textAlign:'center', color:'#bbb', fontSize:10, padding:'16px 0' }}>Run a review to see phase health</div>
                ) : (
                  [1,2,3,4,6,8].map(id => {
                    const names = { 1:'Title Block', 2:'ISO 19650 Naming', 3:'Dimensional', 4:'Regulatory', 6:'Reds10 Standards', 8:'Risks & Gaps' }
                    const pct = phasePassRate(id)
                    return (
                      <div key={id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                        <div style={{ fontSize:9, color:'#666', width:130, flexShrink:0 }}>{names[id]}</div>
                        <div style={{ flex:1, height:6, background:'#f0ede8', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:3, width:`${pct}%`, background:passColor(pct) }} />
                        </div>
                        <div style={{ fontSize:9, color:'#aaa', width:28, textAlign:'right', flexShrink:0 }}>{pct}%</div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
