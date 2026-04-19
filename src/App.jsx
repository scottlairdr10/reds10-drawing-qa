import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './shared/ui'
import { inferGroup, inferProject, loadState, saveState, DRAWING_GROUPS } from './shared/constants'
import { analyseDrawing, fileToBase64 } from './shared/qa-api'
import Dashboard from './pages/Dashboard'
import ProjectView from './pages/ProjectView'
import ReviewPage from './pages/ReviewPage'

export default function App() {
  const [drawings, setDrawings]       = useState([])
  const [page, setPage]               = useState('dashboard') // dashboard | project | review | new-review | all-reviews
  const [activeProject, setActiveProject] = useState(null) // project id
  const [reviewingId, setReviewingId] = useState(null) // drawing id being reviewed

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadState()
    if (saved.drawings) setDrawings(saved.drawings)
  }, [])

  // Save to localStorage whenever drawings change
  useEffect(() => {
    if (drawings.length > 0) saveState({ drawings, projects: [], presets: [] })
  }, [drawings])

  // ── Derive projects from drawings ───────────────────
  const projects = (() => {
    const projectMap = {}
    drawings.forEach(d => {
      if (!d.project) return
      if (!projectMap[d.project]) {
        projectMap[d.project] = { id: d.project, name: d.project, drawings: 0, ragSummary: { red:0, amber:0, green:0 } }
      }
      projectMap[d.project].drawings++
      if (d.result?.overallRAG === 'RED') projectMap[d.project].ragSummary.red++
      if (d.result?.overallRAG === 'AMBER') projectMap[d.project].ragSummary.amber++
      if (d.result?.overallRAG === 'GREEN') projectMap[d.project].ragSummary.green++
    })
    return Object.values(projectMap)
  })()

  // ── Add files ───────────────────────────────────────
  const handleAddFiles = useCallback((files, projectId, groupId) => {
    const newDrawings = []
    Array.from(files).forEach(file => {
      const id = Date.now() + Math.random()
      const previewUrl = (file.type.startsWith('image/') || file.type === 'application/pdf') ? URL.createObjectURL(file) : null
      const project = projectId || inferProject(file.name)
      const group = groupId || inferGroup(file.name)
      newDrawings.push({
        id, name: file.name, fileType: file.type, previewUrl, fileObj: file,
        project, group, loading: false, error: false, result: null, reviewedAt: null, phasesRun: null
      })
    })
    setDrawings(prev => [...prev, ...newDrawings])

    // If added from dashboard (no project pre-selected), jump straight to review the first one
    if (!projectId && newDrawings.length === 1) {
      setReviewingId(newDrawings[0].id)
      setPage('review')
    }
    return newDrawings
  }, [])

  // ── Run QA ──────────────────────────────────────────
  const handleRunQA = useCallback(async (drawing, phases) => {
    setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, loading: true, error: false } : d))
    try {
      let b64Data = null, mtype = null
      if (drawing.fileObj) {
        const res = await fileToBase64(drawing.fileObj)
        b64Data = res.b64
        mtype = res.mtype
      }
      const result = await analyseDrawing({
        drawing, b64: b64Data, mtype, phasesToRun: [...phases]
      })
      setDrawings(prev => prev.map(d => d.id === drawing.id ? {
        ...d, loading: false, error: false, result,
        reviewedAt: new Date().toISOString(),
        phasesRun: [...phases]
      } : d))
    } catch (e) {
      console.error('QA failed', e)
      setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, loading: false, error: true } : d))
    }
  }, [])

  // ── Navigation helpers ──────────────────────────────
  const openDrawing = (id) => { setReviewingId(id); setPage('review') }
  const openProject = (id) => { setActiveProject(id); setPage('project') }
  const backFromReview = () => {
    const d = drawings.find(x => x.id === reviewingId)
    if (d?.project) { setActiveProject(d.project); setPage('project') }
    else setPage('dashboard')
    setReviewingId(null)
  }

  const currentDrawing = drawings.find(d => d.id === reviewingId)
  const currentProject = projects.find(p => p.id === activeProject)

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden',
      fontFamily:"-apple-system,'Segoe UI',sans-serif" }}>

      <Sidebar
        page={page}
        setPage={(p) => { setPage(p); setActiveProject(null); setReviewingId(null) }}
        project={activeProject}
        setProject={setActiveProject}
        projects={projects}
      />

      {page === 'dashboard' && (
        <Dashboard
          drawings={drawings}
          projects={projects}
          onOpenDrawing={openDrawing}
          onOpenProject={openProject}
          onNewReview={() => { setPage('new-review') }}
          onAddFiles={handleAddFiles}
        />
      )}

      {page === 'project' && currentProject && (
        <ProjectView
          project={currentProject}
          drawings={drawings}
          onBack={() => { setActiveProject(null); setPage('dashboard') }}
          onOpenDrawing={openDrawing}
          onAddFiles={handleAddFiles}
          onReviewDrawing={openDrawing}
        />
      )}

      {page === 'review' && currentDrawing && (
        <ReviewPage
          drawing={currentDrawing}
          onBack={backFromReview}
          onUpdateDrawing={(id, updates) => setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))}
          onRunQA={handleRunQA}
        />
      )}

      {/* Placeholder pages */}
      {page === 'new-review' && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f2ee' }}>
          <div style={{ textAlign:'center', maxWidth:400 }}>
            <div style={{ fontSize:32, opacity:0.2, marginBottom:10 }}>🔍</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#40404c', marginBottom:6 }}>New Review</div>
            <div style={{ fontSize:11, color:'#bbb', marginBottom:16 }}>Drop a drawing on the Dashboard to start a new review — or open a project and add drawings there</div>
            <button onClick={() => setPage('dashboard')}
              style={{ background:'#de134d', color:'#fff', border:'none', borderRadius:7,
                padding:'8px 18px', fontSize:11, fontWeight:700, cursor:'pointer' }}>← Back to Dashboard</button>
          </div>
        </div>
      )}
      {page === 'all-reviews' && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f2ee' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, opacity:0.2, marginBottom:10 }}>📁</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#40404c', marginBottom:6 }}>All Reviews</div>
            <div style={{ fontSize:11, color:'#bbb' }}>Coming soon — full searchable list of all reviews</div>
          </div>
        </div>
      )}
      {page === 'preferences' && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f2ee' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, opacity:0.2, marginBottom:10 }}>⚙️</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#40404c' }}>Preferences</div>
            <div style={{ fontSize:11, color:'#bbb', marginTop:6 }}>Coming soon</div>
          </div>
        </div>
      )}
      {page === 'presets' && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f2ee' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, opacity:0.2, marginBottom:10 }}>📋</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#40404c' }}>Phase Presets</div>
            <div style={{ fontSize:11, color:'#bbb', marginTop:6 }}>Coming soon</div>
          </div>
        </div>
      )}

    </div>
  )
}
