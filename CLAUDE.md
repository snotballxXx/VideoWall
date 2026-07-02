# VideoWall

## Project Overview

A browser-based NVR-style surveillance video wall. Users can view unlimited cameras across multiple configurable layouts. Each layout defines a grid (rows × columns); each cell can be assigned a camera stream URL.

## Architecture

- **Frontend:** Next.js 16 (TypeScript, App Router, Tailwind CSS v4) — `/frontend` — port 3000
- **Backend:** C# ASP.NET Core 8 Web API — `/backend` — port 5000
- **Database:** MySQL via Pomelo EF Core provider

## Repository Structure

```
/
├── frontend/
│   ├── src/
│   │   ├── app/            # layout.tsx, page.tsx, globals.css
│   │   ├── components/     # VideoWall.tsx, SettingsPanel.tsx, ThemeProvider.tsx
│   │   ├── lib/            # api.ts (typed API client)
│   │   └── types/          # index.ts (Layout, Camera interfaces)
│   └── Dockerfile
├── backend/
│   ├── Controllers/        # LayoutsController.cs, CamerasController.cs
│   ├── Models/             # Layout.cs, Camera.cs
│   ├── DTOs/               # LayoutDtos.cs
│   ├── Data/               # AppDbContext.cs
│   └── Program.cs
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Node.js >= 20
- .NET 8 SDK
- MySQL server

### Running Locally

```bash
# Backend (port 5000)
cd backend && dotnet run

# Frontend (port 3000)
cd frontend && npm install && npm run dev
```

## Key Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `dotnet run` | Start C# backend |
| `npm run build` | Build frontend |
| `dotnet build` | Build backend |

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5000` |

## Coding Conventions

- TypeScript strict mode enforced
- `PascalCase` for C# classes, `camelCase` for TS variables
- API controllers follow REST conventions
- CSS via Tailwind CSS v4

## Important Notes

Camera video feeds are accessed directly from the browser as cross-origin iframes — no proxying through the backend. The backend stores layout/camera config only.

Authentication is planned for a future phase (backend is structured to support it).

## Backend Implementation Notes

### Database
- MySQL via `Pomelo.EntityFrameworkCore.MySql` 8.x
- Connection string in `backend/appsettings.json` under `ConnectionStrings:DefaultConnection`
- `EnsureCreated()` at startup — creates database and tables automatically if they don't exist
- Server version hardcoded as `MySqlServerVersion(8, 0, 0)` to avoid requiring a live connection at startup just for version detection

### Models
- `Layout` — id, name, rows, columns, order
- `Camera` — id, layoutId (FK cascade), name, url, enabled, row, column

### API Endpoints
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/layouts` | All layouts with cameras, ordered by `Order` |
| POST | `/api/layouts` | Create layout |
| PUT | `/api/layouts/{id}` | Update layout; removes cameras outside new grid bounds |
| DELETE | `/api/layouts/{id}` | Delete layout and cameras (cascade) |
| POST | `/api/cameras` | Create/upsert camera at row/col position |
| PUT | `/api/cameras/{id}` | Update camera name/url/enabled |
| DELETE | `/api/cameras/{id}` | Remove camera (clears cell) |

## Frontend Implementation Notes

### Stack
- Next.js 16 (App Router) with TypeScript strict mode
- Tailwind CSS v4 — uses `@import "tailwindcss"` not the legacy config file
- Class-based dark mode via `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`

### Key Components

**`VideoWall.tsx`**
- Fetches layouts from API on mount
- Tab bar shown when more than one layout exists
- Renders a dynamic CSS grid (`rows × columns`) per layout
- Empty cells show their coordinates; they cannot be clicked or expanded
- Offline cells: no hover highlight, not-allowed cursor, double-click blocked

**`SettingsPanel.tsx`**
- Modal opened via gear icon in header
- Left sidebar: layout list + add new layout
- Right panel: layout name/rows/cols (saved on blur), camera cell grid
- Click a cell → inline form (name, URL, enabled checkbox, save, clear)
- Closing the panel triggers `window.location.reload()` to pick up changes

**`ThemeProvider.tsx`**
- Toggles `dark` class on `<html>` element
- Persisted to `localStorage` under key `vw-theme`
- Defaults to dark

**`api.ts`**
- All fetch calls go to `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`)
- Typed wrappers for all layout and camera endpoints

### Offline Detection
- On mount and every 30 seconds, all enabled cameras are polled via `fetch` with `mode: 'no-cors'` and a 5-second `AbortController` timeout
- Cameras with `enabled: false` or empty `url` are immediately marked offline without polling
- Offline cameras show a struck-through camera SVG icon with "Camera Offline" text (theme-aware)
- iframes are not rendered when url is empty or camera is offline

### Fullscreen (single camera) View
- Scroll wheel zooms toward cursor position (1×–8×)
- Click and drag to pan
- Esc key or "← Grid" button returns to grid
