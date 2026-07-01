'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from './ThemeProvider'

const CAMERAS = [
  { id: 1, label: 'Camera 1', url: 'http://192.168.1.100:1984/stream.html?src=camera1_main', enabled: true },
  { id: 2, label: 'Camera 2', url: 'http://192.168.1.100:1984/stream.html?src=camera2_main', enabled: true },
  { id: 3, label: 'Camera 3', url: 'http://192.168.1.100:1984/stream.html?src=camera3_main', enabled: true },
  { id: 4, label: 'Camera 4', url: 'http://192.168.1.100:1984/stream.html?src=camera4_main', enabled: false },
]

const POLL_INTERVAL_MS = 30_000

type CameraStatus = 'checking' | 'online' | 'offline'

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

function CameraOfflineIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-16 h-16 text-gray-400 dark:text-gray-600"
    >
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

const MIN_ZOOM = 1
const MAX_ZOOM = 8

interface Transform {
  zoom: number
  panX: number
  panY: number
}

export default function VideoWall() {
  const { theme, toggleTheme } = useTheme()
  const [activeCamera, setActiveCamera] = useState<number | null>(null)
  const [transform, setTransform] = useState<Transform>({ zoom: 1, panX: 0, panY: 0 })
  const [statuses, setStatuses] = useState<CameraStatus[]>(
    () => CAMERAS.map(() => 'checking' as CameraStatus)
  )

  useEffect(() => {
    let cancelled = false

    async function pollAll() {
      const results = await Promise.all(
        CAMERAS.map(c => (c.enabled ? checkUrl(c.url) : Promise.resolve(false)))
      )
      if (!cancelled) {
        setStatuses(results.map(ok => (ok ? 'online' : 'offline')))
      }
    }

    pollAll()
    const timer = setInterval(pollAll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  // Refs for synchronous access in event handlers without stale closures
  const transformRef = useRef(transform)
  transformRef.current = transform

  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const transformAtDragStart = useRef<Transform>({ zoom: 1, panX: 0, panY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const resetTransform = useCallback(() => {
    setTransform({ zoom: 1, panX: 0, panY: 0 })
  }, [])

  const exitFullscreen = useCallback(() => {
    setActiveCamera(null)
    resetTransform()
  }, [resetTransform])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exitFullscreen])

  // Wheel zoom — attached imperatively so we can call preventDefault
  useEffect(() => {
    const container = containerRef.current
    if (!container || activeCamera === null) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const { zoom, panX, panY } = transformRef.current

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))

      // Zoom toward the cursor position
      const originX = (cx - panX) / zoom
      const originY = (cy - panY) / zoom
      const newPanX = cx - originX * newZoom
      const newPanY = cy - originY * newZoom

      setTransform({ zoom: newZoom, panX: newPanX, panY: newPanY })
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
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setTransform(prev => ({
      ...prev,
      panX: transformAtDragStart.current.panX + dx,
      panY: transformAtDragStart.current.panY + dy,
    }))
  }, [])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const openFullscreen = (index: number) => {
    resetTransform()
    setActiveCamera(index)
  }

  if (activeCamera !== null) {
    const camera = CAMERAS[activeCamera]
    const { zoom, panX, panY } = transform
    const isOffline = statuses[activeCamera] === 'offline'

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
        {/* Transformed iframe layer */}
        {!isOffline && (
          <div
            style={{
              width: '100%',
              height: '100%',
              transformOrigin: '0 0',
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              willChange: 'transform',
            }}
          >
            <iframe
              src={camera.url}
              title={camera.label}
              className="w-full h-full border-0 pointer-events-none"
            />
          </div>
        )}

        {isOffline && <CameraOfflineOverlay label={camera.label} />}

        {/* Top overlay */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <span className="text-white font-medium text-sm">{camera.label}</span>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={toggleTheme}
              className="text-white/70 hover:text-white text-lg leading-none px-2 py-1 rounded hover:bg-white/10 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀' : '☽'}
            </button>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={exitFullscreen}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              ← Grid
            </button>
          </div>
        </div>

        {/* Bottom overlay */}
        {!isOffline && (
          <div className="absolute bottom-0 inset-x-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            <span className="text-white/50 text-xs">
              {zoom.toFixed(1)}x · scroll to zoom · drag to pan · Esc to exit
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black dark:bg-black">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-950 border-b border-gray-300 dark:border-gray-800 shrink-0">
        <h1 className="text-gray-900 dark:text-white font-semibold text-sm tracking-wide">
          VideoWall
        </h1>
        <button
          onClick={toggleTheme}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-base px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
      </header>

      {/* 2×2 camera grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-px bg-gray-400 dark:bg-gray-800 overflow-hidden">
        {CAMERAS.map((camera, index) => {
          const status = statuses[index]
          const offline = status === 'offline'

          return (
            <div
              key={camera.id}
              className="relative overflow-hidden bg-black cursor-pointer group"
              onDoubleClick={() => openFullscreen(index)}
            >
              {!offline && (
                <iframe
                  src={camera.url}
                  title={camera.label}
                  className="w-full h-full border-0 pointer-events-none"
                />
              )}

              {offline && <CameraOfflineOverlay label={camera.label} />}

              {/* Camera label (shown when online) */}
              {!offline && (
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded select-none pointer-events-none">
                  {camera.label}
                </div>
              )}

              {/* Hover ring */}
              <div className="absolute inset-0 ring-2 ring-inset ring-transparent group-hover:ring-blue-400 transition-all pointer-events-none" />

              {/* Hover hint (only when online) */}
              {!offline && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full">
                    Double-click to expand
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
