'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

type Mode = 'resize' | 'enhance' | 'bgremove'

const PRESETS = [
  { label: '1080×1080', w: 1080, h: 1080 },
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1080×1920', w: 1080, h: 1920 },
  { label: '512×512', w: 512, h: 512 },
  { label: 'Custom', w: 0, h: 0 },
]

const MODE_META: Record<Mode, { label: string; icon: string; gradient: string; glow: string }> = {
  resize:   { label: 'Resize',     icon: '⇲',  gradient: 'from-violet-500 to-indigo-500',  glow: 'shadow-violet-500/40' },
  enhance:  { label: 'Enhance',    icon: '✦',  gradient: 'from-cyan-500 to-blue-500',      glow: 'shadow-cyan-500/40'   },
  bgremove: { label: 'Remove BG',  icon: '⬡',  gradient: 'from-pink-500 to-rose-500',      glow: 'shadow-pink-500/40'   },
}

function Slider({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: number) => void; color: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full bg-white/5 ${color}`}>{value}</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${
            label === 'Sharpen' ? 'from-cyan-500 to-blue-500' :
            label === 'Denoise' ? 'from-emerald-500 to-teal-500' :
            'from-amber-500 to-orange-500'
          } transition-all`}
          style={{ width: `${value}%` }}
        />
        <input
          type="range" min={0} max={100} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
        />
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-400 border-r-pink-400 animate-spin-slow" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-cyan-400 border-l-blue-400 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">⚡</div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-white font-semibold text-lg shimmer-text">Processing…</p>
          <p className="text-slate-400 text-sm">This may take a moment</p>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('resize')
  const [srcFile, setSrcFile] = useState<File | null>(null)
  const [srcUrl, setSrcUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [keepAspect, setKeepAspect] = useState(true)
  const [preset, setPreset] = useState('Custom')
  const [naturalW, setNaturalW] = useState(0)
  const [naturalH, setNaturalH] = useState(0)

  const [sharpen, setSharpen] = useState(0)
  const [denoise, setDenoise] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [glossy, setGlossy] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const srcUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
  }, [])

  const onFile = useCallback((file: File) => {
    if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current)
    if (resultUrlRef.current) { URL.revokeObjectURL(resultUrlRef.current); resultUrlRef.current = null }
    const url = URL.createObjectURL(file)
    srcUrlRef.current = url
    setSrcFile(file)
    setSrcUrl(url)
    setResultUrl(null)
    setError(null)
    setPreset('Custom')
    const img = new Image()
    img.onload = () => { setNaturalW(img.naturalWidth); setNaturalH(img.naturalHeight) }
    img.src = url
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  const onWidthChange = (val: string) => {
    setWidth(val); setPreset('Custom')
    if (keepAspect && naturalW && naturalH && val)
      setHeight(String(Math.round(Number(val) * naturalH / naturalW)))
  }

  const onHeightChange = (val: string) => {
    setHeight(val); setPreset('Custom')
    if (keepAspect && naturalW && naturalH && val)
      setWidth(String(Math.round(Number(val) * naturalW / naturalH)))
  }

  const applyPreset = (label: string) => {
    setPreset(label)
    const p = PRESETS.find((x) => x.label === label)
    if (!p || p.w === 0) return
    setWidth(String(p.w)); setHeight(String(p.h))
  }

  const run = async () => {
    if (!srcFile) return
    setLoading(true); setError(null); setResultUrl(null)
    try {
      const fd = new FormData()
      fd.append('file', srcFile)
      fd.append('mode', mode)
      if (mode === 'resize') {
        if (width) fd.append('width', width)
        if (height) fd.append('height', height)
        fd.append('keepAspect', String(keepAspect))
      } else if (mode === 'enhance') {
        fd.append('sharpen', String(sharpen))
        fd.append('denoise', String(denoise))
        fd.append('contrast', String(contrast))
        fd.append('glossy', String(glossy))
      }
      const res = await fetch('/api/process', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.text()) || res.statusText)
      const blob = await res.blob()
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
      const rUrl = URL.createObjectURL(blob)
      resultUrlRef.current = rUrl
      setResultUrl(rUrl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!resultUrl || !srcFile) return
    const a = document.createElement('a')
    a.href = resultUrl
    const ext = mode === 'bgremove' ? 'png' : srcFile.name.split('.').pop() || 'png'
    a.download = `result_${srcFile.name.replace(/\.[^.]+$/, '')}.${ext}`
    a.click()
  }

  const canProcess = !!srcFile && (
    mode === 'bgremove' ||
    (mode === 'resize' && (!!width || !!height)) ||
    (mode === 'enhance' && (glossy || sharpen > 0 || denoise > 0 || contrast > 0))
  )

  const meta = MODE_META[mode]

  return (
    <div className="min-h-screen bg-[#080a12] text-white overflow-x-hidden">
      {loading && <Loader />}

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-700/15 blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-pink-700/10 blur-[80px]" />
      </div>

      <div className={`relative mx-auto px-4 py-12 space-y-8 transition-all duration-500 ${resultUrl ? 'max-w-5xl' : 'max-w-2xl'}`}>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-slate-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Local processing — no data leaves your machine
          </div>
          <h1 className="text-5xl font-black tracking-tight">
            <span className="shimmer-text">Image Tools</span>
          </h1>
          <p className="text-slate-500 text-sm">Resize · Enhance · Remove Background</p>
        </div>

        {/* Upload zone — collapses to compact strip when result is shown */}
        {!resultUrl ? (
          <div
            className={`relative rounded-2xl p-1 cursor-pointer transition-all duration-300 ${
              dragging
                ? 'bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500'
                : 'bg-gradient-to-r from-violet-500/30 via-pink-500/20 to-cyan-500/30 hover:from-violet-500/50 hover:via-pink-500/40 hover:to-cyan-500/50'
            }`}
            onClick={() => fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
          >
            <div className="rounded-[14px] bg-[#0d0f1a] p-8 text-center min-h-[160px] flex flex-col items-center justify-center gap-3">
              {srcUrl ? (
                <>
                  <img src={srcUrl} alt="source" className="max-h-48 rounded-xl object-contain shadow-2xl" />
                  {naturalW > 0 && (
                    <p className="text-xs text-slate-500">{srcFile?.name} · {naturalW}×{naturalH}px</p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-4xl animate-float">🖼️</div>
                  <p className="text-slate-300 font-medium">Drop image here or click to upload</p>
                  <p className="text-xs text-slate-600">JPG · PNG · WebP · TIFF · AVIF · up to 10 MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
        ) : (
          /* Compact re-upload strip */
          <button
            className="w-full glass glass-hover rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-slate-400 hover:text-white transition-all"
            onClick={() => fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
          >
            <span className="text-lg">🖼️</span>
            <span className="truncate flex-1 text-left">{srcFile?.name ?? 'Upload image'}</span>
            {naturalW > 0 && <span className="text-xs text-slate-600 shrink-0">{naturalW}×{naturalH}</span>}
            <span className="text-xs text-slate-600 border border-white/10 rounded px-2 py-0.5">Change</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </button>
        )}

        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(MODE_META) as [Mode, typeof MODE_META[Mode]][]).map(([id, m]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`relative rounded-xl p-4 text-center transition-all duration-300 ${
                mode === id
                  ? `bg-gradient-to-br ${m.gradient} shadow-lg ${m.glow}`
                  : 'glass glass-hover'
              }`}
            >
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className={`text-sm font-semibold ${mode === id ? 'text-white' : 'text-slate-400'}`}>{m.label}</div>
            </button>
          ))}
        </div>

        {/* Controls panel */}
        <div className="glass rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-lg font-bold bg-gradient-to-r ${meta.gradient} bg-clip-text text-transparent`}>
              {meta.icon} {meta.label}
            </span>
          </div>

          {mode === 'resize' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Preset</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p.label)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        preset === p.label
                          ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30'
                          : 'glass glass-hover text-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                {[
                  { label: 'Width (px)', val: width, set: onWidthChange },
                  { label: 'Height (px)', val: height, set: onHeightChange },
                ].map(({ label, val, set }) => (
                  <div key={label} className="flex-1">
                    <label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">{label}</label>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder="auto"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition placeholder-slate-600"
                    />
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-10 h-5 rounded-full transition-all ${keepAspect ? 'bg-gradient-to-r from-violet-500 to-indigo-500' : 'bg-white/10'}`}>
                  <div className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-all ${keepAspect ? 'ml-5' : 'ml-0.5'}`} />
                </div>
                <input type="checkbox" checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} className="hidden" />
                <span className="text-sm text-slate-300 group-hover:text-white transition">Keep aspect ratio</span>
              </label>
            </div>
          )}

          {mode === 'enhance' && (
            <div className="space-y-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-10 h-5 rounded-full transition-all ${glossy ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-white/10'}`}>
                  <div className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-all ${glossy ? 'ml-5' : 'ml-0.5'}`} />
                </div>
                <input type="checkbox" checked={glossy} onChange={(e) => setGlossy(e.target.checked)} className="hidden" />
                <div>
                  <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition">✨ Glossy Preset</span>
                  <span className="text-xs text-slate-500 ml-2">denoise + sharpen + contrast + saturation</span>
                </div>
              </label>

              {!glossy && (
                <div className="space-y-5">
                  <Slider label="Sharpen" value={sharpen} onChange={setSharpen} color="text-cyan-400" />
                  <Slider label="Denoise" value={denoise} onChange={setDenoise} color="text-emerald-400" />
                  <Slider label="Contrast" value={contrast} onChange={setContrast} color="text-amber-400" />
                </div>
              )}
            </div>
          )}

          {mode === 'bgremove' && (
            <div className="flex items-start gap-4 p-4 rounded-xl bg-pink-500/5 border border-pink-500/20">
              <span className="text-3xl animate-float">🪄</span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-200">AI-powered background removal</p>
                <p className="text-xs text-slate-500">Runs locally via ONNX — no API key needed.</p>
                <p className="text-xs text-amber-400/80">⚡ First run downloads ~45 MB model</p>
              </div>
            </div>
          )}
        </div>

        {/* Process button */}
        <button
          onClick={run}
          disabled={!canProcess || loading}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 relative overflow-hidden ${
            canProcess && !loading
              ? `bg-gradient-to-r ${meta.gradient} shadow-xl ${meta.glow} hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]`
              : 'bg-white/5 text-slate-600 cursor-not-allowed'
          }`}
        >
          {canProcess && !loading && (
            <div className="absolute inset-0 bg-white/10 animate-gradient opacity-0 hover:opacity-100 transition-opacity" />
          )}
          <span className="relative">
            {loading ? 'Processing…' : `Apply ${meta.label}`}
          </span>
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-lg">⚠️</span>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Side-by-side comparison */}
        {resultUrl && srcUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Before / After</span>
              <button
                onClick={download}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:scale-105 hover:shadow-emerald-500/50 transition-all active:scale-95"
              >
                ↓ Download
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Original */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Original</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0d0f1a]">
                  <img
                    src={srcUrl}
                    alt="original"
                    className="w-full object-contain max-h-[400px]"
                    style={{ background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #16213e 0% 50%) 0 0 / 20px 20px' }}
                  />
                </div>
                {naturalW > 0 && (
                  <p className="text-xs text-slate-600 text-center">{naturalW}×{naturalH}px</p>
                )}
              </div>
              {/* Result */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Result</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                  <img
                    src={resultUrl}
                    alt="result"
                    className="w-full object-contain max-h-[400px]"
                    style={{ background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #16213e 0% 50%) 0 0 / 20px 20px' }}
                  />
                </div>
                <p className="text-xs text-slate-600 text-center">{meta.label} applied</p>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-slate-700 pt-4">
          Image Tools · sharp + ONNX · runs entirely on your machine
        </footer>
      </div>
    </div>
  )
}
