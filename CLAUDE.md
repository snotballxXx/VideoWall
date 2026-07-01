# VideoWall

## Project Overview

This project is to provide a user of a surveillance system the ability to view up to 4 cameras NVR style.
The cameras are to be displayed taking up the full screen and divided into 4 quarters.
Doubling clicking one of the quarters will display that view in full screen, Esc key goes back to multi-view.

Panning and zoom functionality is to be provided when a camera view is in full screen

## Architecture

- Frontend: Next.js (TypeScript) — located in `/frontend`
- Backend: C# ASP.NET Core — located in `/backend`

## Repository Structure

```
/
├── frontend/       # Next.js app
├── backend/        # C# API
└── ...
```

## Getting Started

### Prerequisites

- Node.js >= 20
- .NET 8 SDK

### Running Locally

**Frontend**

```bash
# commands to start the frontend dev server
```

**Backend**

```bash
# commands to start the backend
```

## Key Commands

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start Next.js dev server |
| `dotnet run`    | Start C# backend         |
| `npm run build` | Build frontend           |
| `dotnet build`  | Build backend            |
| `npm run test`  | Run frontend tests       |
| `dotnet test`   | Run backend tests        |

## Environment Variables

<!-- List required env vars and where to find/set them, e.g.:
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5000` |
| `DATABASE_URL` | Connection string | `...` |
-->

## Coding Conventions

- TypeScript strict mode enforced
- Use `PascalCase` for C# classes, `camelCase` for TS variables
- API controllers follow REST conventions
- CSS via Tailwind / CSS Modules / styled-components

## Testing

- Unit tests:
- Integration tests:
- E2E tests:

## Deployment

<!-- How and where the app is deployed:
- Frontend:
- Backend:
- CI/CD:
-->

## Important Notes

The backend will be used to store user details for authentication, and camera feed URLs.

Camera video feeds will be accessed directly from the front end  
Example URLs:  
camera1: - http://192.168.1.100:1984/stream.html?src=camera1_main  
camera2: - http://192.168.1.100:1984/stream.html?src=camera2_main  
camera3: - http://192.168.1.100:1984/stream.html?src=camera3_main  
camera4: - http://192.168.1.100:1984/stream.html?src=camera4_main

<!-- Anything Claude should be aware of:
- Known gotchas or quirks
- Areas of the codebase that are sensitive or complex
- Third-party integrations
-->

## Frontend Implementation Notes

### Stack
- Next.js 16 (App Router) with TypeScript strict mode
- Tailwind CSS v4 — uses `@import "tailwindcss"` not the legacy config file
- Class-based dark mode configured via `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`

### Camera Config (`frontend/src/components/VideoWall.tsx`)
Cameras are defined as a hardcoded array at the top of `VideoWall.tsx`. Each entry has:
- `id` — numeric identifier
- `label` — display name shown as overlay
- `url` — full iframe URL to the stream
- `enabled` — set to `false` to immediately treat as offline without polling

Camera 4 is currently `enabled: false` while its stream is being resolved.

### Offline Detection
- On mount and every 30 seconds, each enabled camera URL is fetched with `mode: 'no-cors'` and a 5-second `AbortController` timeout
- Any network failure or timeout → status set to `'offline'`
- Disabled cameras (`enabled: false`) are skipped and immediately set to `'offline'`
- Offline cameras show a struck-through camera SVG icon with "Camera Offline" text
- The offline overlay is theme-aware (light/dark)

### Theme
- `ThemeProvider` component wraps the app and toggles the `dark` class on `<html>`
- Preference is persisted to `localStorage` under the key `vw-theme`
- Defaults to dark on first load

### Grid View
- 2×2 fixed layout filling the full viewport
- Cameras embedded as cross-origin iframes with `pointer-events: none`
- Double-click any cell to enter single-camera fullscreen view

### Fullscreen (single camera) View
- Scroll wheel zooms toward cursor position (1×–8×)
- Click and drag to pan
- Esc key or "← Grid" button returns to grid view
- iframe is unmounted when a camera is offline (replaced by offline overlay)
