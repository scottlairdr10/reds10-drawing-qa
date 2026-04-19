import { API_URL, getHeaders, PHASES } from './constants'

// Returns parsed result or throws
export async function analyseDrawing({ drawing, b64, mtype, phasesToRun }) {
  const phaseList = phasesToRun || [1,2,3,4,5,6,7,8]
  const phaseNames = PHASES.filter(([id]) => phaseList.includes(id)).map(([id,name]) => `${id}. ${name}`).join('\n')
  const system = `You are a specialist drawing QA reviewer for Reds10 Group, a UK volumetric modular construction company.
Review drawings against ISO 19650 file naming, NDSS 2015 space standards, UK Building Regulations (Parts A,B,F,L,M), British Standards, Reds10 internal standards, and Employer Requirements.

Run ONLY these QA phases (mark others as NA with reason "Not selected"):
${phaseNames}

For each phase assign RAG (RED/AMBER/GREEN/NA) and list findings with actions.
Respond ONLY in this exact JSON (no markdown, no preamble):
{"summary":"one sentence overview","drawingRef":"ref or Unknown","drawingType":"type identified","overallRAG":"RED|AMBER|GREEN","phases":[{"id":1,"name":"Title Block Completeness","rag":"RED|AMBER|GREEN|NA","naReason":null,"findings":[{"rag":"RED|AMBER|GREEN","finding":"issue description","action":"what to do"}]}],"criticalFindings":[{"phase":"phase name","finding":"description","action":"required action"}],"issueRecommendation":"one line verdict on readiness to issue"}`

  const userContent = b64
    ? [{ type:'image', source:{ type:'base64', media_type:mtype||'image/png', data:b64 } },
       { type:'text', text:'Perform a full QA review of this drawing across all selected phases. Return only valid JSON.' }]
    : `Perform a full QA review of drawing "${drawing.name}". No image — assess from filename only. Return only valid JSON.`

  const res = await fetch(API_URL, {
    method:'POST', headers:getHeaders(),
    body: JSON.stringify({
      model:'claude-sonnet-4-20250514', max_tokens:2000, system,
      messages:[{ role:'user', content:userContent }]
    }),
  })
  if (!res.ok) { const e = await res.text(); console.error('API',res.status,e); throw new Error(`API ${res.status}`) }
  const data = await res.json()
  const text = data.content?.map(c => c.text||'').join('')
  if (!text) throw new Error('Empty response')
  return JSON.parse(text.replace(/```json|```/g,'').trim())
}

// Convert a file to base64 for API submission
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      // Convert PDF page 1 to JPEG
      const loadScript = () => new Promise(r => {
        if (window.pdfjsLib) return r()
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; r() }
        document.head.appendChild(s)
      })
      loadScript().then(() => {
        window.pdfjsLib.getDocument(URL.createObjectURL(file)).promise.then(pdf => {
          pdf.getPage(1).then(page => {
            const vp = page.getViewport({ scale:2 })
            const canvas = document.createElement('canvas')
            canvas.width = vp.width; canvas.height = vp.height
            page.render({ canvasContext:canvas.getContext('2d'), viewport:vp }).promise.then(() => {
              resolve({ b64: canvas.toDataURL('image/jpeg',0.85).split(',')[1], mtype: 'image/jpeg' })
            })
          })
        }).catch(reject)
      })
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => resolve({ b64: e.target.result.split(',')[1], mtype: file.type })
      reader.onerror = reject
      reader.readAsDataURL(file)
    } else {
      resolve({ b64: null, mtype: null })
    }
  })
}

// Chat with streaming
export async function streamChat({ system, messages, onToken, onDone, onError }) {
  try {
    const res = await fetch(API_URL, {
      method:'POST', headers:getHeaders(),
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:1500, stream:true, system, messages
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
            if (delta) { fullText += delta; onToken(fullText) }
          } catch {}
        }
      }
    }
    onDone(fullText)
  } catch (e) {
    onError(e)
  }
}
