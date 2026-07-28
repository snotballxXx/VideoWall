export interface Camera {
  id: number
  layoutId: number
  name: string
  url: string
  enabled: boolean
  row: number
  column: number
}

export interface Layout {
  id: number
  name: string
  rows: number
  columns: number
  order: number
  cameras: Camera[]
}

export type TimelapseStatus = 'Running' | 'Stopped' | 'Exporting' | 'Completed' | 'Failed'

export interface TimelapseJob {
  id: number
  cameraId: number
  status: TimelapseStatus
  intervalSeconds: number
  createdAt: string
  stoppedAt: string | null
  frameCount: number
  hasVideo: boolean
}
