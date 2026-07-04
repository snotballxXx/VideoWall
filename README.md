# VideoWall

A browser-based NVR-style surveillance video wall supporting unlimited cameras across multiple configurable layouts.

## Features

- **Multiple layouts** — each layout has configurable rows and columns; switch between them via tabs (tabs hidden when only one layout exists)
- **Unlimited cameras** — any number of cameras assigned to cells in any layout
- **Admin settings panel** — gear icon in the header opens an in-app panel to add/edit/delete layouts and camera assignments without leaving the page
- **Single-camera fullscreen** — double-click any online cell to expand; Esc or "← Grid" to return
- **Zoom & pan** — scroll wheel to zoom (up to 8×) toward cursor, click-drag to pan in fullscreen view
- **Offline detection** — cameras poll every 30 seconds; unreachable or disabled cameras show a "Camera Offline" overlay; offline cells cannot be double-clicked or highlighted
- **Light & dark theme** — toggle in the header; preference saved across sessions

## Architecture

- **Frontend:** Next.js 16 (TypeScript, App Router, Tailwind CSS v4) — `/frontend`
- **Backend:** C# ASP.NET Core 8 Web API — `/backend`
- **Database:** MySQL — schema auto-created on first run via EF Core `EnsureCreated`

## Repository Structure

```
/
├── frontend/           # Next.js app (port 3000)
│   ├── src/
│   │   ├── app/        # Next.js App Router pages and layout
│   │   ├── components/ # VideoWall, SettingsPanel, ThemeProvider
│   │   ├── lib/        # API client (api.ts)
│   │   └── types/      # Shared TypeScript types
│   └── Dockerfile
├── backend/            # C# ASP.NET Core Web API (port 5000)
│   ├── Controllers/    # LayoutsController, CamerasController
│   ├── Models/         # Layout, Camera
│   ├── DTOs/           # Request/response records
│   └── Data/           # AppDbContext (EF Core)
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Node.js >= 20
- .NET 8 SDK
- MySQL server

### Configuration

Set the MySQL connection string in `backend/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=<host>;Database=videowall;User=<user>;Password=<password>;"
  }
}
```

The `videowall` database and all tables are created automatically on first run.

Set the backend URL for the frontend (defaults to `http://localhost:5000`):

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Running Locally

**Backend**

```bash
cd backend
dotnet run
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the gear icon to configure layouts and cameras.

### Docker

```bash
docker-compose up --build
```

Starts both frontend (port 3000) and backend (port 5000). To override the database connection string without editing `appsettings.json`, update the `ConnectionStrings__DefaultConnection` value in `docker-compose.yml`.

### Building for Production

```bash
cd frontend && npm run build && npm run start
cd backend && dotnet publish -c Release
```

## Key Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server (port 3000) |
| `npm run build` | Build frontend for production |
| `dotnet run` | Start C# backend (port 5000) |
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
