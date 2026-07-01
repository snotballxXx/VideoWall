# VideoWall

A browser-based NVR-style surveillance video wall for viewing up to 4 IP camera streams simultaneously.

## Features

- **2×2 camera grid** — all four streams displayed full-screen, divided into equal quarters
- **Single-camera fullscreen** — double-click any cell to expand; Esc to return to grid
- **Zoom & pan** — scroll wheel to zoom (up to 8×) toward cursor, click-drag to pan, while in fullscreen view
- **Offline detection** — cameras that are unreachable display a "Camera Offline" indicator automatically; individual cameras can also be disabled in config
- **Light & dark theme** — toggle in the header; preference is saved across sessions

## Architecture

- **Frontend:** Next.js 16 (TypeScript, App Router) — `/frontend`
- **Backend:** C# ASP.NET Core — `/backend` *(authentication and camera URL storage — not yet implemented)*

## Getting Started

### Prerequisites

- Node.js >= 20
- .NET 8 SDK *(for backend, when implemented)*

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
cd frontend
npm run build
npm run start
```

## Camera Configuration

Camera streams are currently hardcoded in `frontend/src/components/VideoWall.tsx`. Each camera entry supports an `enabled` flag — set to `false` to mark a camera as offline without polling:

```ts
const CAMERAS = [
  { id: 1, label: 'Camera 1', url: 'http://192.168.1.100:1984/stream.html?src=camera1_main', enabled: true },
  // ...
]
```

Camera URLs are served as iframes directly from the browser to the NVR host. No proxying through the backend.

## Key Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build frontend for production |
| `npm run start` | Start production server |
| `dotnet run` | Start C# backend *(not yet implemented)* |