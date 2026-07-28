'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Camera, Layout, TimelapseJob } from '@/types'

interface Props {
  layouts: Layout[]
  onClose: () => void
}

interface CellFormState {
  name: string
  url: string
  enabled: boolean
}

export default function SettingsPanel({ layouts: initial, onClose }: Props) {
  const [layouts, setLayouts] = useState(initial)
  const [selectedId, setSelectedId] = useState<number | null>(initial[0]?.id ?? null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [cellForm, setCellForm] = useState<CellFormState>({ name: '', url: '', enabled: true })
  const [saving, setSaving] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [timelapseJobs, setTimelapseJobs] = useState<TimelapseJob[]>([])
  const [timelapseInterval, setTimelapseInterval] = useState(60)
  const [timelapseBusy, setTimelapseBusy] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const selected = layouts.find(l => l.id === selectedId) ?? null

  function closeAndReloadIfChanged() {
    onClose()
    if (hasChanges) window.location.reload()
  }

  useEffect(() => {
    const cam = selected && editingCell
      ? selected.cameras.find(c => c.row === editingCell.row && c.column === editingCell.col)
      : undefined
    if (!cam) { setTimelapseJobs([]); return }
    let cancelled = false
    const poll = () => api.timelapses.list(cam.id).then(jobs => { if (!cancelled) setTimelapseJobs(jobs) })
    poll()
    const id = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [selected, editingCell])

  async function startTimelapse(cameraId: number) {
    setTimelapseBusy(true)
    try {
      const job = await api.timelapses.create({ cameraId, intervalSeconds: timelapseInterval })
      setTimelapseJobs([job])
    } finally {
      setTimelapseBusy(false)
    }
  }

  async function stopTimelapse(id: number) {
    setTimelapseBusy(true)
    try {
      const job = await api.timelapses.stop(id)
      setTimelapseJobs(js => js.map(j => j.id === id ? job : j))
    } finally {
      setTimelapseBusy(false)
    }
  }

  async function deleteTimelapse(id: number) {
    setTimelapseBusy(true)
    try {
      await api.timelapses.delete(id)
      setTimelapseJobs(js => js.filter(j => j.id !== id))
    } finally {
      setTimelapseBusy(false)
    }
  }

  function cameraAt(layout: Layout, row: number, col: number): Camera | undefined {
    return layout.cameras.find(c => c.row === row && c.column === col)
  }

  function openCell(row: number, col: number) {
    if (!selected) return
    if (editingCell?.row === row && editingCell?.col === col) {
      setEditingCell(null)
      return
    }
    const cam = cameraAt(selected, row, col)
    setCellForm({ name: cam?.name ?? '', url: cam?.url ?? '', enabled: cam?.enabled ?? true })
    setEditingCell({ row, col })
  }

  async function saveCell() {
    if (!selected || !editingCell) return
    setSaving(true)
    try {
      const existing = cameraAt(selected, editingCell.row, editingCell.col)
      let updated: Camera
      if (existing) {
        updated = await api.cameras.update(existing.id, cellForm)
        setLayouts(ls => ls.map(l => l.id !== selected.id ? l : {
          ...l,
          cameras: l.cameras.map(c => c.id === existing.id ? updated : c)
        }))
      } else {
        updated = await api.cameras.create({
          layoutId: selected.id,
          row: editingCell.row,
          column: editingCell.col,
          ...cellForm,
        })
        setLayouts(ls => ls.map(l => l.id !== selected.id ? l : {
          ...l,
          cameras: [...l.cameras, updated]
        }))
      }
      setEditingCell(null)
      setHasChanges(true)
    } finally {
      setSaving(false)
    }
  }

  async function clearCell() {
    if (!selected || !editingCell) return
    const existing = cameraAt(selected, editingCell.row, editingCell.col)
    if (!existing) { setEditingCell(null); return }
    setSaving(true)
    try {
      await api.cameras.delete(existing.id)
      setLayouts(ls => ls.map(l => l.id !== selected.id ? l : {
        ...l,
        cameras: l.cameras.filter(c => c.id !== existing.id)
      }))
      setEditingCell(null)
      setHasChanges(true)
    } finally {
      setSaving(false)
    }
  }

  async function addLayout() {
    const name = newLayoutName.trim() || `Layout ${layouts.length + 1}`
    const order = layouts.length
    const layout = await api.layouts.create({ name, rows: 2, columns: 2, order })
    setLayouts(ls => [...ls, layout])
    setSelectedId(layout.id)
    setNewLayoutName('')
    setHasChanges(true)
  }

  async function updateLayoutMeta(field: 'name' | 'rows' | 'columns', value: string | number) {
    if (!selected) return
    const updated = await api.layouts.update(selected.id, {
      name: field === 'name' ? String(value) : selected.name,
      rows: field === 'rows' ? Number(value) : selected.rows,
      columns: field === 'columns' ? Number(value) : selected.columns,
      order: selected.order,
    })
    setLayouts(ls => ls.map(l => l.id === selected.id ? updated : l))
    setEditingCell(null)
    setHasChanges(true)
  }

  async function deleteLayout() {
    if (!selected) return
    await api.layouts.delete(selected.id)
    const remaining = layouts.filter(l => l.id !== selected.id)
    setLayouts(remaining)
    setSelectedId(remaining[0]?.id ?? null)
    setConfirmingDelete(false)
    setHasChanges(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={e => { if (e.target === e.currentTarget) closeAndReloadIfChanged() }}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[860px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={closeAndReloadIfChanged}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Left — layout list */}
          <div className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 pt-4 pb-2">Layouts</p>
            <ul className="flex-1 overflow-y-auto">
              {layouts.map(l => (
                <li key={l.id}>
                  <button
                    onClick={() => { setSelectedId(l.id); setEditingCell(null); setConfirmingDelete(false) }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      l.id === selectedId
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {l.name}
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({l.rows}×{l.columns})</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 space-y-1.5">
              <input
                value={newLayoutName}
                onChange={e => setNewLayoutName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLayout()}
                placeholder="New layout name…"
                className="w-full text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={addLayout}
                className="w-full text-xs py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                + Add Layout
              </button>
            </div>
          </div>

          {/* Right — layout editor */}
          {selected ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Layout metadata */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                  <input
                    defaultValue={selected.name}
                    key={`name-${selected.id}`}
                    onBlur={e => updateLayoutMeta('name', e.target.value)}
                    className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rows</label>
                  <input
                    type="number" min={1} max={10}
                    defaultValue={selected.rows}
                    key={`rows-${selected.id}`}
                    onBlur={e => updateLayoutMeta('rows', e.target.value)}
                    className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Columns</label>
                  <input
                    type="number" min={1} max={10}
                    defaultValue={selected.columns}
                    key={`cols-${selected.id}`}
                    onBlur={e => updateLayoutMeta('columns', e.target.value)}
                    className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Camera grid */}
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Camera Cells — click to assign</p>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${selected.columns}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: selected.rows }).map((_, row) =>
                    Array.from({ length: selected.columns }).map((_, col) => {
                      const cam = cameraAt(selected, row, col)
                      const isEditing = editingCell?.row === row && editingCell?.col === col
                      const isCapturing = isEditing && timelapseJobs.some(j => j.status === 'Running' || j.status === 'Exporting')
                      return (
                        <div key={`${row}-${col}`} className="flex flex-col gap-1">
                          <button
                            onClick={() => openCell(row, col)}
                            className={`rounded border text-xs px-2 py-2 text-left transition-colors ${
                              isEditing
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : cam
                                  ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                                  : 'border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-400 hover:border-blue-400'
                            }`}
                          >
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 block mb-0.5">{row},{col}</span>
                            {cam ? cam.name : <span className="italic">Empty</span>}
                            {cam && !cam.enabled && <span className="ml-1 text-[10px] text-amber-500">(disabled)</span>}
                          </button>

                          {isEditing && (
                            <div className="border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-gray-800 p-2 space-y-1.5 text-xs">
                              <input
                                value={cellForm.name}
                                onChange={e => setCellForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Camera name"
                                disabled={isCapturing}
                                className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                              />
                              <input
                                value={cellForm.url}
                                onChange={e => setCellForm(f => ({ ...f, url: e.target.value }))}
                                placeholder="Stream URL"
                                disabled={isCapturing}
                                className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                              />
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={cellForm.enabled}
                                  onChange={e => setCellForm(f => ({ ...f, enabled: e.target.checked }))}
                                  disabled={isCapturing}
                                  className="rounded disabled:opacity-50"
                                />
                                <span className="text-gray-700 dark:text-gray-300">Enabled</span>
                              </label>

                              {cam && (
                                <div className="border-t border-gray-200 dark:border-gray-600 pt-1.5 mt-1 space-y-1">
                                  <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Timelapse</p>

                                  {!timelapseJobs.some(j => j.status === 'Running' || j.status === 'Exporting') && (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min={5}
                                        value={timelapseInterval}
                                        onChange={e => setTimelapseInterval(Number(e.target.value))}
                                        onBlur={() => setTimelapseInterval(v => Math.max(5, v || 5))}
                                        className="w-16 px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                      <span className="text-gray-500 dark:text-gray-400">sec interval</span>
                                      <button
                                        onClick={() => startTimelapse(cam.id)}
                                        disabled={timelapseBusy || timelapseInterval < 5}
                                        className="ml-auto py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
                                      >
                                        Start
                                      </button>
                                    </div>
                                  )}

                                  {timelapseJobs.map(job => (
                                    <div key={job.id} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                      <span className="flex-1">{job.status} · {job.frameCount} frames</span>
                                      {job.status === 'Running' && (
                                        <button
                                          onClick={() => stopTimelapse(job.id)}
                                          disabled={timelapseBusy}
                                          className="py-1 px-2 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
                                        >
                                          Stop
                                        </button>
                                      )}
                                      {job.status === 'Completed' && job.hasVideo && (
                                        <a
                                          href={api.timelapses.downloadUrl(job.id)}
                                          className="py-1 px-2 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                        >
                                          Download
                                        </a>
                                      )}
                                      {job.status !== 'Running' && (
                                        <button
                                          onClick={() => deleteTimelapse(job.id)}
                                          disabled={timelapseBusy}
                                          className="py-1 px-2 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-1.5 pt-0.5">
                                {!isCapturing && (
                                  <button
                                    onClick={saveCell}
                                    disabled={saving}
                                    className="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                                  >
                                    Save
                                  </button>
                                )}
                                {cam && !isCapturing && (
                                  <button
                                    onClick={clearCell}
                                    disabled={saving}
                                    className="py-1 px-2 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                                  >
                                    Clear
                                  </button>
                                )}
                                <button
                                  onClick={() => setEditingCell(null)}
                                  className="py-1 px-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Delete layout */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                {confirmingDelete ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-300 flex-1">
                      Delete <span className="font-semibold">{selected?.name}</span>? This removes all its cameras too.
                    </p>
                    <button
                      onClick={deleteLayout}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors shrink-0"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                  >
                    Delete this layout
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              No layouts yet — add one to get started
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
