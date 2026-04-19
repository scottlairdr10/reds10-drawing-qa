import { useState, useRef } from 'react'
import { BRAND, DRAWING_GROUPS, timeAgo } from '../shared/constants'
import { RAGBadge } from '../shared/ui'
import { exportReport } from '../shared/export'

export default function ProjectView({ project, drawings, onBack, onOpenDrawing, onAddFiles, onReviewDrawing }) {
  const fileRef = useRef()
  const [openGroups, setOpenGroups] = useState(new Set(['architectural','structural']))
  const toggleGroup = id => setOpenGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Filter drawings for this project
  const projectDrawings = drawings.filter(d => d.project === project.id)

  // Group drawings
  const grouped = {}
  DRAWING_GROUPS.forEach(g => { grouped[g.id] = projectDrawings.filter(d => d.group === g.id) })

  // Stats
  const redC = projectDrawings.filter(d=>d.result?.overallRAG==='RED').length
  const ambC = projectDrawings.filter(d=>d.result?.overallRAG==='AMBER').length
  const grnC = projectDrawings.filter(d=>d.result?.overallRAG==='GREEN').length
  const unreviewed = projectDrawings.filter(d=>!d.result).length
  const lastReview = projectDrawings.filter(d=>d.reviewedAt).sort((a,b)=>new Date(b.reviewedAt)-new Date(a.reviewedAt))[0]

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f4f2ee', overflow:'hidden' }}>
      {/* Topbar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e0ddd7', padding:'0 24px', height:52,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#bbb' }}>
            <span onClick={onBack} style={{ cursor:'pointer' }}>Projects</span>
            <span style={{ color:'#ddd' }}>›</span>
            <span style={{ fontSize:14, fontWeight:800, color:BRAND.charcoal }}>{project.name}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f4f2ee', border:'1px solid #e0ddd7',
            borderRadius:20, padding:'4px 12px', fontSize:10, fontWeight:600, color:'#666' }}>
            🏫 Active · {projectDrawings.length} drawings
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f4f2ee',
            border:'1.5px solid #e0ddd7', borderRadius:7, padding:'6px 12px', fontSize:11, color:'#999', width:180 }}>
            🔍 Search in project…
          </div>
          <button onClick={() => exportReport(projectDrawings.filter(d=>d.result), `${project.name} — QA Report`)}
            style={{ background:'#fff', color:BRAND.charcoal, border:'1.5px solid #e0ddd7',
              borderRadius:7, padding:'7px 14px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
            Export all reports
          </button>
          <button onClick={() => fileRef.current?.click()}
            style={{ background:BRAND.red, color:'#fff', border:'none', borderRadius:7,
              padding:'8px 16px', fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Add drawings</button>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf" style={{ display:'none' }}
            onChange={e => onAddFiles(e.target.files, project.id)} />
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e0ddd7', padding:'10px 24px',
        display:'flex', alignItems:'center', gap:24, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#666' }}>
          <span style={{ fontSize:15, fontWeight:800, color:BRAND.charcoal }}>{projectDrawings.length}</span> Total drawings
        </div>
        <div style={{ width:1, height:20, background:'#e8e5e0' }} />
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#de134d' }}>{redC}</span>
          <span style={{ color:'#de134d', fontWeight:600 }}>RED</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#ef9f27' }}>{ambC}</span>
          <span style={{ color:'#ef9f27', fontWeight:600 }}>AMBER</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#639922' }}>{grnC}</span>
          <span style={{ color:'#639922', fontWeight:600 }}>GREEN</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#666' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#bbb' }}>{unreviewed}</span> Not reviewed
        </div>
        {lastReview && (
          <>
            <div style={{ width:1, height:20, background:'#e8e5e0' }} />
            <div style={{ fontSize:11, color:'#666' }}>
              Last review: <strong style={{ color:BRAND.charcoal, marginLeft:4 }}>{timeAgo(lastReview.reviewedAt)}</strong>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>

        {DRAWING_GROUPS.map(group => {
          const items = grouped[group.id]
          if (items.length === 0) return null // skip empty groups unless explicitly added
          const isOpen = openGroups.has(group.id)
          const gRed = items.filter(d=>d.result?.overallRAG==='RED').length
          const gAmb = items.filter(d=>d.result?.overallRAG==='AMBER').length
          const gGrn = items.filter(d=>d.result?.overallRAG==='GREEN').length
          const gNone = items.filter(d=>!d.result).length
          const isCritical = gRed > 0

          return (
            <div key={group.id} style={{
              background:'#fff',
              border:`1px solid ${isCritical && !isOpen ? '#f5c1c1' : '#e0ddd7'}`,
              borderRadius:10, marginBottom:12, overflow:'hidden'
            }}>
              {/* Group header */}
              <div onClick={() => toggleGroup(group.id)}
                style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                  userSelect:'none', borderBottom: isOpen ? '1px solid #f0ede8' : 'none',
                  background: isCritical && !isOpen ? '#fff8f8' : 'transparent' }}>
                <span style={{ fontSize:13, color:'#bbb',
                  transform:isOpen?'rotate(90deg)':'none', transition:'transform 0.2s', flexShrink:0 }}>›</span>
                <span style={{ fontSize:16 }}>{group.icon}</span>
                <span style={{ fontSize:12, fontWeight:700, flex:1,
                  color: isCritical && !isOpen ? '#a32d2d' : BRAND.charcoal }}>{group.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, color:'#999', background:'#f4f2ee', borderRadius:10, padding:'2px 8px' }}>
                    {items.length} drawing{items.length>1?'s':''}
                  </span>
                  <div style={{ display:'flex', gap:4 }}>
                    {gRed > 0 && <RAGBadge status="RED" size="sm" />}
                    {gAmb > 0 && <RAGBadge status="AMBER" size="sm" />}
                    {gGrn > 0 && <RAGBadge status="GREEN" size="sm" />}
                    {gNone > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:8,
                      fontWeight:600, color:'#aaa', background:'#f4f2ee', border:'1px solid #e0ddd7',
                      borderRadius:10, padding:'2px 7px' }}>⏳ {gNone}</span>}
                  </div>
                </div>
              </div>

              {/* File rows */}
              {isOpen && (
                <>
                  {items.map(d => {
                    const reviewed = !!d.result
                    return (
                      <div key={d.id} onClick={() => reviewed ? onOpenDrawing(d.id) : onReviewDrawing(d.id)}
                        onMouseEnter={e => e.currentTarget.style.background='#fafaf8'}
                        onMouseLeave={e => e.currentTarget.style.background=''}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 16px 9px 42px',
                          borderBottom:'1px solid #f8f6f3', cursor:'pointer', opacity: reviewed ? 1 : 0.65 }}>
                        <div style={{ width:36, height:36, background:'#f0ede8', border:'1px solid #e0ddd7',
                          borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:14, flexShrink:0, overflow:'hidden' }}>
                          {d.previewUrl ? <img src={d.previewUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '📄'}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color: reviewed ? BRAND.charcoal : '#888',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {d.result?.drawingRef || d.name}
                          </div>
                          <div style={{ fontSize:9, color:'#bbb', marginTop:1 }}>
                            {d.result?.drawingType || group.name}
                          </div>
                        </div>
                        <div style={{ fontSize:9, color:'#aaa', width:140, flexShrink:0 }}>
                          {d.phasesRun ? (d.phasesRun.length === 8 ? 'Full check · 8 phases' : `${d.phasesRun.length} phases`) : '—'}
                        </div>
                        {reviewed
                          ? <RAGBadge status={d.result.overallRAG} size="sm" />
                          : <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:8,
                              fontWeight:600, color:'#aaa', background:'#f4f2ee', border:'1px solid #e0ddd7',
                              borderRadius:10, padding:'2px 7px' }}>⏳ Not reviewed</span>}
                        <div style={{ fontSize:9, color:'#bbb', whiteSpace:'nowrap', flexShrink:0, width:60 }}>
                          {timeAgo(d.reviewedAt)}
                        </div>
                        <div style={{ fontSize:10, color: reviewed ? BRAND.red : '#aaa', fontWeight:600,
                          whiteSpace:'nowrap', flexShrink:0, padding:'4px 10px',
                          border:`1px solid ${reviewed ? '#fad8e2' : '#e0ddd7'}`, borderRadius:5 }}>
                          {reviewed ? 'Open →' : 'Review →'}
                        </div>
                      </div>
                    )
                  })}
                  {/* Drop zone in group */}
                  <div onClick={() => fileRef.current?.click()}
                    onDrop={e => { e.preventDefault(); onAddFiles(e.dataTransfer.files, project.id, group.id) }}
                    onDragOver={e => e.preventDefault()}
                    style={{ margin:'8px 16px 10px 42px', border:'1.5px dashed #e0ddd7', borderRadius:7,
                      padding:10, display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                      color:'#bbb', fontSize:10, transition:'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=BRAND.red; e.currentTarget.style.color=BRAND.red; e.currentTarget.style.background='#fff8fa' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#e0ddd7'; e.currentTarget.style.color='#bbb'; e.currentTarget.style.background='' }}>
                    <span style={{ fontSize:16 }}>+</span>
                    <span>Drop {group.name.toLowerCase()} drawings here to add to this group</span>
                  </div>
                </>
              )}
              {!isOpen && isCritical && (
                <div style={{ padding:'6px 16px 8px 42px', fontSize:9, color:'#de134d',
                  fontStyle:'italic', background:'#fff8f8' }}>
                  ⚠ Critical findings — click to expand and review
                </div>
              )}
            </div>
          )
        })}

        {projectDrawings.length === 0 && (
          <div style={{ background:'#fff', borderRadius:10, border:'2px dashed #e0ddd7', padding:'40px 20px',
            textAlign:'center', color:'#bbb' }}>
            <div style={{ fontSize:32, marginBottom:12, opacity:0.4 }}>📁</div>
            <div style={{ fontSize:13, fontWeight:700, color:BRAND.charcoal, marginBottom:6 }}>No drawings in this project yet</div>
            <div style={{ fontSize:10, marginBottom:16 }}>Click "Add drawings" above to upload drawings and group them automatically</div>
            <button onClick={() => fileRef.current?.click()}
              style={{ background:BRAND.red, color:'#fff', border:'none', borderRadius:7,
                padding:'8px 18px', fontSize:11, fontWeight:700, cursor:'pointer' }}>📂 Browse files</button>
          </div>
        )}

      </div>
    </div>
  )
}
