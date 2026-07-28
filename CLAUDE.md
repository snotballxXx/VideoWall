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
│   ├── Controllers/        # LayoutsController.cs, CamerasController.cs, TimelapsesController.cs
│   ├── Models/             # Layout.cs, Camera.cs, TimelapseJob.cs
│   ├── DTOs/               # LayoutDtos.cs, TimelapseDtos.cs
│   ├── Data/               # AppDbContext.cs
│   ├── Services/           # TimelapseCaptureService.cs (background capture), TimelapsePaths.cs
│   └── Program.cs
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Node.js >= 20
- .NET 8 SDK
- MySQL server
- `ffmpeg` on PATH (required for timelapse video export; installed automatically in the backend Docker image, but must be installed separately for local `dotnet run`)

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
- `TimelapseJob` — id, cameraId (FK cascade), intervalSeconds, status (`Running`/`Stopped`/`Exporting`/`Completed`/`Failed`), createdAt, lastCapturedAt, stoppedAt, frameCount

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
| GET | `/api/timelapses?cameraId=` | List timelapse jobs, optionally filtered by camera |
| POST | `/api/timelapses` | Start a job (`{cameraId, intervalSeconds}`, min 5s); 409 if one's already running for that camera; deletes that camera's previous job(s) and files first |
| POST | `/api/timelapses/{id}/stop` | Stop capture and export the frames to `output.mp4` via ffmpeg |
| GET | `/api/timelapses/{id}/download` | Download the exported video (only once `Completed`), named `<camera-name>-timelapse-<id>.mp4` |
| DELETE | `/api/timelapses/{id}` | Delete a job and its on-disk frames/video |

### Timelapse Capture
- `TimelapseCaptureService` (`Services/TimelapseCaptureService.cs`) is a `BackgroundService` that ticks every ~1s, finds `Running` jobs due for a frame (based on `IntervalSeconds` since `LastCapturedAt`/`CreatedAt`), and fetches one via `IHttpClientFactory`
- Frame fetch is tolerant of both single-snapshot and MJPEG-stream URLs: it reads with an 8s timeout and scans the response bytes for a JPEG (`0xFFD8`...`0xFFD9`) rather than assuming the whole body is one image
- go2rtc's `/stream.html?src=X&mode=mse` (the interactive WebRTC/MSE player page used for the live iframe) returns no image data at all — `DeriveSnapshotUrl` detects that URL shape and rewrites it to go2rtc's `/api/frame.jpeg?src=X` snapshot endpoint for capture purposes only; the display iframe keeps using the original URL
- Frames are written to `{Timelapse:StoragePath}/{jobId}/frame_{000001}.jpg` (config in `appsettings.json`, default `timelapse-storage` relative to the working directory)
- On stop, frames are assembled into `output.mp4` via `ffmpeg -y -nostdin -framerate {Timelapse:OutputFramerate} -i frame_%06d.jpg -c:v libx264 -pix_fmt yuv420p output.mp4`, run without redirecting stdout/stderr (redirecting without draining the streams deadlocks once ffmpeg's chatty progress output fills the pipe buffer)
- Export failures are always caught and set the job to `Failed` rather than leaving it stuck in `Exporting`
- Only one `Running` job per camera at a time; starting a new one deletes that camera's previous job(s) (DB rows + on-disk frames/video)
- `EnsureCreated()` only builds the full schema on a completely empty database — adding `TimelapseJob` did **not** retroactively create the table on any pre-existing `videowall` database. A fresh/empty database (or a manual `CREATE TABLE`) is needed to pick up new entities added this way, since the project doesn't use EF Core Migrations

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
- Polls `api.timelapses.list()` (all cameras) every 5s; header shows a pulsing "Recording" badge left of the refresh button when any job is `Running`, and each capturing camera's name badge gets a matching pulsing red dot

**`SettingsPanel.tsx`**
- Modal opened via gear icon in header
- Left sidebar: layout list + add new layout
- Right panel: layout name/rows/cols (saved on blur), camera cell grid
- Click a cell → inline form (name, URL, enabled checkbox, save, clear); the form also has a Timelapse section (interval input + Start, or status/frame count + Stop/Download/Delete for existing jobs), polled every 5s while the cell is open
- While a capture is `Running`/`Exporting` for that cell's camera, the name/URL/enabled inputs are disabled and Save/Clear are hidden (Close remains available)
- Closing the panel only triggers `window.location.reload()` if a layout/camera was actually created/updated/deleted during the session (tracked via a `hasChanges` flag) — starting/stopping timelapses doesn't set it

**`ThemeProvider.tsx`**
- Toggles `dark` class on `<html>` element
- Persisted to `localStorage` under key `vw-theme`
- Defaults to dark

**`api.ts`**
- All fetch calls go to `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`)
- Typed wrappers for all layout, camera, and timelapse endpoints (`api.timelapses.list/create/stop/delete/downloadUrl`)

**`app/api/[...path]/route.ts`**
- Proxies all `/api/*` calls to the backend (`BACKEND_URL`, default `http://localhost:5001`)
- Responses with a non-JSON content type (e.g. the timelapse video download) are streamed through as-is instead of being parsed/re-serialized as JSON

### Offline Detection
- On mount and every 30 seconds, all enabled cameras are polled via `fetch` with `mode: 'no-cors'` and a 5-second `AbortController` timeout
- Cameras with `enabled: false` or empty `url` are immediately marked offline without polling
- Offline cameras show a struck-through camera SVG icon with "Camera Offline" text (theme-aware)
- iframes are not rendered when url is empty or camera is offline

### Fullscreen (single camera) View
- Scroll wheel zooms toward cursor position (1×–8×)
- Click and drag to pan
- Esc key or "← Grid" button returns to grid
