'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import type { Camera, Layout } from '@/types'

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

  const selected = layouts.find(l => l.id === selectedId) ?? null

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
  }

  async function deleteLayout() {
    if (!selected || !confirm(`Delete "${selected.name}"?`)) return
    await api.layouts.delete(selected.id)
    const remaining = layouts.filter(l => l.id !== selected.id)
    setLayouts(remaining)
    setSelectedId(remaining[0]?.id ?? null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={e => { if (e.target === e.currentTarget) { onClose(); window.location.reload() } }}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[860px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={() => { onClose(); window.location.reload() }}
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
                    onClick={() => { setSelectedId(l.id); setEditingCell(null) }}
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
                                className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                value={cellForm.url}
                                onChange={e => setCellForm(f => ({ ...f, url: e.target.value }))}
                                placeholder="Stream URL"
                                className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={cellForm.enabled}
                                  onChange={e => setCellForm(f => ({ ...f, enabled: e.target.checked }))}
                                  className="rounded"
                                />
                                <span className="text-gray-700 dark:text-gray-300">Enabled</span>
                              </label>
                              <div className="flex gap-1.5 pt-0.5">
                                <button
                                  onClick={saveCell}
                                  disabled={saving}
                                  className="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                                >
                                  Save
                                </button>
                                {cam && (
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
                <button
                  onClick={deleteLayout}
                  className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                >
                  Delete this layout
                </button>
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
