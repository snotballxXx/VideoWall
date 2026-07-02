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
