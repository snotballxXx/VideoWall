'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from './ThemeProvider'
import SettingsPanel from './SettingsPanel'
import { api } from '@/lib/api'
import type { Camera, Layout } from '@/types'

const POLL_INTERVAL_MS = 30_000
const MIN_ZOOM = 1
const MAX_ZOOM = 8

async function checkUrl(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

function CameraOfflineIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-gray-400 dark:text-gray-600">
      <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.361a1 1 0 0 1-1.447.894L15 14" />
      <rect x="1" y="7" width="14" height="10" rx="2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

function CameraOfflineOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 gap-3 select-none pointer-events-none">
      <CameraOfflineIcon />
      <div className="text-center">
        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{label}</p>
        <p className="text-gray-500 dark:text-gray-600 text-xs mt-0.5">Camera Offline</p>
      </div>
    </div>
  )
}

type CameraStatus = 'checking' | 'online' | 'offline'

interface Transform { zoom: number; panX: number; panY: number }
interface ActiveCamera { camera: Camera; layoutIndex: number }

export default function VideoWall() {
  const { theme, toggleTheme } = useTheme()
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLayoutIndex, setActiveLayoutIndex] = useState(0)
  const [activeCamera, setActiveCamera] = useState<ActiveCamera | null>(null)
  const [transform, setTransform] = useState<Transform>({ zoom: 1, panX: 0, panY: 0 })
  const [statuses, setStatuses] = useState<Record<string, CameraStatus>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadLayouts = useCallback(() => {
    return api.layouts.getAll()
      .then(data => { setLayouts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Load layouts from API
  useEffect(() => {
    loadLayouts()
  }, [loadLayouts])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    loadLayouts().finally(() => setRefreshing(false))
  }, [loadLayouts])

  // Poll all camera URLs for status
  useEffect(() => {
    const cameras = layouts.flatMap(l => l.cameras)
    if (cameras.length === 0) return

    let cancelled = false

    async function pollAll() {
      const entries = await Promise.all(
        cameras.map(async c => {
          const ok = c.enabled && c.url ? await checkUrl(c.url) : false
          return [c.id.toString(), ok ? 'online' : 'offline'] as const
        })
      )
      if (!cancelled) setStatuses(Object.fromEntries(entries))
    }

    pollAll()
    const timer = setInterval(pollAll, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [layouts])

  const transformRef = useRef(transform)
  transformRef.current = transform
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const transformAtDragStart = useRef<Transform>({ zoom: 1, panX: 0, panY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const resetTransform = useCallback(() => setTransform({ zoom: 1, panX: 0, panY: 0 }), [])
  const exitFullscreen = useCallback(() => { setActiveCamera(null); resetTransform() }, [resetTransform])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exitFullscreen() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exitFullscreen])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !activeCamera) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const { zoom, panX, panY } = transformRef.current
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
      const originX = (cx - panX) / zoom
      const originY = (cy - panY) / zoom
      setTransform({ zoom: newZoom, panX: cx - originX * newZoom, panY: cy - originY * newZoom })
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [activeCamera])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    transformAtDragStart.current = { ...transformRef.current }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    setTransform(prev => ({
      ...prev,
      panX: transformAtDragStart.current.panX + (e.clientX - dragStart.current.x),
      panY: transformAtDragStart.current.panY + (e.clientY - dragStart.current.y),
    }))
  }, [])

  const onMouseUp = useCallback(() => { isDragging.current = false }, [])

  // Fullscreen single-camera view
  if (activeCamera) {
    const { camera } = activeCamera
    const { zoom, panX, panY } = transform
    const isOffline = statuses[camera.id.toString()] === 'offline'

    return (
      <div
        ref={containerRef}
        className="fixed inset-0 bg-black overflow-hidden select-none"
        style={{ cursor: isOffline ? 'default' : isDragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={isOffline ? undefined : onMouseDown}
        onMouseMove={isOffline ? undefined : onMouseMove}
        onMouseUp={isOffline ? undefined : onMouseUp}
        onMouseLeave={isOffline ? undefined : onMouseUp}
      >
        {!isOffline && camera.url && (
          <div style={{ width: '100%', height: '100%', transformOrigin: '0 0', transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, willChange: 'transform' }}>
            <iframe src={camera.url} title={camera.name} className="w-full h-full border-0 pointer-events-none" />
          </div>
        )}
        {isOffline && <CameraOfflineOverlay label={camera.name} />}

        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <span className="text-white font-medium text-sm">{camera.name}</span>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button onMouseDown={e => e.stopPropagation()} onClick={toggleTheme} className="text-white/70 hover:text-white text-lg px-2 py-1 rounded hover:bg-white/10 transition-colors" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? '☀' : '☽'}
            </button>
            <button onMouseDown={e => e.stopPropagation()} onClick={exitFullscreen} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-sm transition-colors">
              ← Grid
            </button>
          </div>
        </div>

        {!isOffline && (
          <div className="absolute bottom-0 inset-x-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            <span className="text-white/50 text-xs">{zoom.toFixed(1)}x · scroll to zoom · drag to pan · Esc to exit</span>
          </div>
        )}
      </div>
    )
  }

  const currentLayout = layouts[activeLayoutIndex]

  return (
    <div className="flex flex-col h-full bg-black">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-950 border-b border-gray-300 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-gray-900 dark:text-white font-semibold text-sm tracking-wide">VideoWall</h1>

          {/* Tabs — hidden when only one layout */}
          {layouts.length > 1 && (
            <div className="flex gap-1">
              {layouts.map((l, i) => (
                <button
                  key={l.id}
                  onClick={() => setActiveLayoutIndex(i)}
                  className={`text-xs px-3 py-1 rounded transition-colors ${
                    i === activeLayoutIndex
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleRefresh} disabled={refreshing} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors disabled:opacity-50" title="Refresh">
            <RefreshIcon spinning={refreshing} />
          </button>
          <button onClick={() => setShowSettings(true)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" title="Settings">
            <GearIcon />
          </button>
          <button onClick={toggleTheme} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-base px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? '☀' : '☽'}
          </button>
        </div>
      </header>

      {/* Camera grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
          Loading…
        </div>
      ) : !currentLayout ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-500">
          <p className="text-sm">No layouts configured.</p>
          <button onClick={() => setShowSettings(true)} className="text-xs px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors">
            Open Settings
          </button>
        </div>
      ) : (
        <div
          className="flex-1 grid gap-px bg-gray-400 dark:bg-gray-800 overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${currentLayout.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${currentLayout.rows}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: currentLayout.rows }).map((_, row) =>
            Array.from({ length: currentLayout.columns }).map((_, col) => {
              const camera = currentLayout.cameras.find(c => c.row === row && c.column === col)
              const offline = camera ? statuses[camera.id.toString()] === 'offline' : false

              return (
                <div
                  key={`${row}-${col}`}
                  className={`relative overflow-hidden bg-black group ${offline ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  onDoubleClick={() => {
                    if (!camera || offline) return
                    resetTransform()
                    setActiveCamera({ camera, layoutIndex: activeLayoutIndex })
                  }}
                >
                  {camera && !offline && camera.url && (
                    <iframe src={camera.url} title={camera.name} className="w-full h-full border-0 pointer-events-none" />
                  )}
                  {camera && offline && <CameraOfflineOverlay label={camera.name} />}
                  {!camera && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-700 dark:text-gray-700 text-xs select-none pointer-events-none">
                      {row},{col}
                    </div>
                  )}

                  {camera && !offline && (
                    <>
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded select-none pointer-events-none">
                        {camera.name}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full">Double-click to expand</span>
                      </div>
                    </>
                  )}
                  {!offline && <div className="absolute inset-0 ring-2 ring-inset ring-transparent group-hover:ring-blue-400 transition-all pointer-events-none" />}
                </div>
              )
            })
          )}
        </div>
      )}

      {showSettings && <SettingsPanel layouts={layouts} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
