import type { Camera, Layout } from '@/types'

const API = ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  layouts: {
    getAll: () => request<Layout[]>('/api/layouts'),
    create: (data: { name: string; rows: number; columns: number; order: number }) =>
      request<Layout>('/api/layouts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string; rows: number; columns: number; order: number }) =>
      request<Layout>(`/api/layouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/layouts/${id}`, { method: 'DELETE' }),
  },
  cameras: {
    create: (data: { layoutId: number; name: string; url: string; enabled: boolean; row: number; column: number }) =>
      request<Camera>('/api/cameras', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string; url: string; enabled: boolean }) =>
      request<Camera>(`/api/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/cameras/${id}`, { method: 'DELETE' }),
  },
}
