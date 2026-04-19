import { BRAND, LOGO, RAG } from './constants'

export function RAGBadge({ status, size = 'md' }) {
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

export function Sidebar({ page, setPage, project, setProject, projects }) {
  const navItem = (id, icon, label) => {
    const active = page === id && !project
    return (
      <div key={id} onClick={() => { setPage(id); setProject(null) }}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', cursor:'pointer',
          fontSize:11, fontWeight:600, transition:'background 0.15s',
          color: active ? BRAND.chalk : 'rgba(227,222,210,0.5)',
          background: active ? 'rgba(222,19,77,0.15)' : 'transparent',
          borderRight: active ? `3px solid ${BRAND.red}` : '3px solid transparent' }}
        onMouseEnter={e => { if(!active) { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#e3ded2' }}}
        onMouseLeave={e => { if(!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(227,222,210,0.5)' }}}>
        <span style={{ fontSize:13, width:18, textAlign:'center' }}>{icon}</span>
        <span>{label}</span>
      </div>
    )
  }

  const section = (label) => (
    <div style={{ padding:'10px 14px 4px', fontSize:7, fontWeight:700,
      color:'rgba(227,222,210,0.25)', letterSpacing:1, textTransform:'uppercase', marginTop:4 }}>{label}</div>
  )

  const projectItem = (p) => {
    const active = project === p.id
    const projDotColor = p.ragSummary?.red > 0 ? BRAND.red : p.ragSummary?.amber > 0 ? '#ef9f27' : '#639922'
    return (
      <div key={p.id} onClick={() => { setPage('project'); setProject(p.id) }}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', cursor:'pointer',
          fontSize:10, fontWeight:600,
          color: active ? BRAND.chalk : 'rgba(227,222,210,0.45)',
          background: active ? 'rgba(222,19,77,0.1)' : 'transparent',
          borderLeft: active ? `3px solid ${BRAND.red}` : '3px solid transparent' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:projDotColor, flexShrink:0 }} />
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
      </div>
    )
  }

  return (
    <div style={{ width:200, background:BRAND.charcoal, display:'flex', flexDirection:'column', flexShrink:0, height:'100vh' }}>
      {/* Logo */}
      <div style={{ padding:'12px 12px 10px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <img src={LOGO} alt="Reds10" style={{ height:28, width:'auto', display:'block' }}
          onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }} />
        <div style={{ display:'none', fontSize:13, fontWeight:800, color:BRAND.chalk }}>Reds10</div>
        <div style={{ fontSize:7, color:'rgba(227,222,210,0.35)', letterSpacing:1.2,
          textTransform:'uppercase', marginTop:5 }}>Drawing QA</div>
      </div>

      <div style={{ height:8 }} />
      {section('Main')}
      {navItem('dashboard', '📊', 'Dashboard')}
      {navItem('new-review', '🔍', 'New Review')}
      {navItem('all-reviews', '📁', 'All Reviews')}

      {section('Projects')}
      {projects.length === 0 && (
        <div style={{ padding:'8px 14px', fontSize:9, color:'rgba(227,222,210,0.25)', fontStyle:'italic' }}>
          No projects yet
        </div>
      )}
      {projects.map(projectItem)}

      {section('Settings')}
      {navItem('preferences', '⚙️', 'Preferences')}
      {navItem('presets', '📋', 'Phase presets')}

      {/* User footer */}
      <div style={{ marginTop:'auto', padding:12, borderTop:'1px solid rgba(255,255,255,0.08)',
        display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:26, height:26, borderRadius:'50%', background:BRAND.red,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:9, fontWeight:700, color:'#fff', flexShrink:0 }}>SL</div>
        <div>
          <div style={{ fontSize:10, fontWeight:600, color:BRAND.chalk }}>Scott Laird</div>
          <div style={{ fontSize:7, color:'rgba(227,222,210,0.4)' }}>QA Lead · Reds10</div>
        </div>
      </div>
    </div>
  )
}
