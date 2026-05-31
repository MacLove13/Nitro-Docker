# Nitro Docker – Agent Context Guide

This file provides AI agents with a structured overview of the **Nitro Docker** project so they can resolve tasks efficiently and with minimal token usage.

---

## Project Overview

**Nitro Docker** is a Docker-based development environment for running a Habbo-like game server stack locally on Windows, Linux, or macOS. It orchestrates four main services via `docker-compose`:

| Service   | Container name  | Default port(s)          |
|-----------|-----------------|--------------------------|
| MySQL     | `mysql-nitro`   | `13306` (host → `3306`)  |
| Arcturus  | `arcturus`      | `3000`, `3001`, `2096`   |
| Nitro     | `nitro`         | `1080`, `8080`, `8081`   |
| CMS       | `cms`           | `8082`                   |

All services share a single Docker network named `nitro`.

---

## Components

### 1. MySQL (`mysql/`)

- **What it is**: MariaDB 10.6 database server used by both the Arcturus emulator and the CMS.
- **Credentials** (set in `docker-compose.yaml`):
  - Root password: `arcturus_root_pw`
  - User / password: `arcturus_user` / `arcturus_pw`
  - Database: `arcturus`
- **Init dumps**: SQL files placed in `mysql/dumps/` are loaded automatically on first start.
- **Config**: Custom MySQL options live in `mysql/conf.d/`.
- **Access**: `just mysql` opens an interactive MySQL console inside the running container.

---

### 2. Arcturus Emulator (`emulator/`)

- **What it is**: The game server (emulator) that implements the Habbo protocol. Based on [Arcturus Morningstar](https://git.krews.org/nitro/morningstar), a Java/Maven project.
- **Submodule location**: `emulator/arcturus/` (Git submodule pointing to Krews GitLab).
- **NitroWebSocket plugin**: Pre-bundled so Nitro React can connect via WebSocket.
- **Build**: Maven (`mvn package`). The Docker image compiles the emulator from source on every fresh build; subsequent starts reuse the compiled JAR cached in the `volume-arcturus-target` volume.
- **Configuration**: `emulator/config.ini` — edit here to change ports, hotel name, DB settings, etc.
- **Supervisor process**: `arcturus-emulator` (managed by `supervisord` inside the container).
- **Key `just` commands**:
  - `just restart-arcturus` – restart the running emulator
  - `just recompile-arcturus` – stop, recompile from source, restart
  - `just watch-arcturus` – tail emulator logs
  - `just shell-arcturus` – open a bash shell inside the container

---

### 3. Nitro (Client + Asset Pipeline) (`nitro/`)

The `nitro` container runs **three servers** simultaneously via `supervisord`:

#### 3a. Nitro React (Client / Front-end)
- **What it is**: The browser-based Habbo client built with React + TypeScript. Source lives in `nitro/nitro-react/` (Git submodule).
- **Dev server**: Craco (Create React App override), served on port `1080` (mapped to internal `5154`).
- **Production build**: `yarn build:prod` produces a `dist/` folder for deployment.
- **Configuration**: JSON config files in `nitro/configuration/nitro-react/`. After editing, run `just restart-nitro` to apply changes.
- **Access**: [http://127.0.0.1:1080?sso=123](http://127.0.0.1:1080?sso=123) (the `sso=123` token is the default demo SSO ticket).

#### 3b. Assets Server
- **What it is**: A static HTTP server (http-server) serving pre-converted `.nitro` asset files from `nitro/nitro-assets/`.
- **Port**: `8080` (used by the client to load furniture, figures, effects, etc.).

#### 3c. SWF / Morningstar Server
- **What it is**: Serves the original Habbo SWF files from `nitro/nitro-swf/`. These are the source files consumed by the nitro-converter.
- **Port**: `8081`.

#### 3d. Nitro Converter (`nitro/nitro-converter/`)
- **What it is**: A Node.js/TypeScript tool (Git submodule) that reads SWF files from the SWF server and outputs `.nitro` binary assets into `nitro/nitro-assets/`.
- **How to run**: `just extract-nitro-assets` (runs inside the container).
- **Config**: Copied from `nitro/configuration/nitro-converter/configuration.json` before each run.

- **Key `just` commands**:
  - `just restart-nitro` – copy public config files and restart the dev server
  - `just watch-nitro` – tail the Craco dev-server logs
  - `just shell-nitro` – open a bash shell inside the container
  - `just extract-nitro-assets` – convert SWF → `.nitro` assets

---

### 4. CMS (`cms/`)

- **What it is**: **Cosmic CMS** — a PHP web application (Apache + PHP) that provides the hotel website, login, registration, SSO generation, and catalogue management. Based on the [Cosmic](https://github.com/devraizer/Cosmic) project; only compatible with Arcturus Morningstar.
- **Source**: `cms/Cosmic/` (the PHP application root mapped to `/var/www/html`).
- **Database migrations**: SQL files in `cms/Database/` are applied automatically.
- **Plugins**: Additional Cosmic plugins live in `cms/Plugins/`.
- **Environment variables** (set in `docker-compose.yaml`):
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` – database connection
  - `CMS_DOMAIN` – public domain of the CMS (default: `localhost:8082`)
  - `CMS_NITRO_PATH` – URL of the Nitro client (default: `http://localhost:1080`)
  - `CMS_ASSET_PATH` – URL of the assets server (default: `http://localhost:8080`)
  - `CMS_SHORTNAME` / `CMS_SITENAME` – hotel branding
- **Access**: [http://localhost:8082](http://localhost:8082)
- **Key `just` commands**:
  - `just restart-cms` – restart the CMS container
  - `just watch-cms` – tail CMS/Apache logs
  - `just shell-cms` – open a shell inside the container

---

## Repository Layout

```
Nitro-Docker/
├── cms/                    # CMS service (Cosmic PHP application)
│   ├── Cosmic/             # PHP source (Apache docroot)
│   ├── Database/           # SQL migrations
│   ├── Plugins/            # Cosmic plugins
│   ├── Dockerfile
│   └── scripts/build.sh
├── emulator/               # Arcturus emulator service
│   ├── arcturus/           # Git submodule – Java/Maven source
│   ├── config.ini          # Emulator configuration
│   ├── Dockerfile
│   └── scripts/build.sh
├── mysql/                  # MySQL service
│   ├── conf.d/             # MySQL config overrides
│   └── dumps/              # Initial SQL dumps
├── nitro/                  # Nitro service (client + assets)
│   ├── nitro-react/        # Git submodule – React client
│   ├── nitro-converter/    # Git submodule – SWF → .nitro converter
│   ├── nitro-assets/       # Output .nitro assets
│   ├── nitro-swf/          # Source SWF files
│   ├── configuration/      # Runtime config for nitro-react & converter
│   ├── Dockerfile
│   └── scripts/build.sh
├── docker-compose.yaml     # Orchestrates all services
├── justfile                # Task runner shortcuts
└── README.md               # Quick-start guide
```

---

## Common Workflows

| Goal | Command |
|------|---------|
| First-time setup | `just install && just start-all` |
| Start everything | `just start-all` |
| Stop & clean all Docker data | `just clean-docker` |
| Recompile emulator | `just recompile-arcturus` |
| Restart client dev server | `just restart-nitro` |
| Convert SWF assets | `just extract-nitro-assets` |
| Open MySQL console | `just mysql` |
| List all commands | `just --list` |

---

## Key Relationships

```
Browser → [CMS :8082]   → PHP/Cosmic (SSO generation, hotel website)
Browser → [Nitro :1080] → Nitro React client (TypeScript/React)
Nitro   → [Assets :8080]→ .nitro asset files (furniture, avatars, effects)
Nitro   → [Arcturus :3000/3001] → Game server (WebSocket, Habbo protocol)
Arcturus → [MySQL :3306] → MariaDB (rooms, users, catalogue, etc.)
CMS      → [MySQL :3306] → same database
```

---

## Notes for AI Agents

- **Do not modify** `emulator/arcturus/` or `nitro/nitro-react/` or `nitro/nitro-converter/` directly — these are Git submodules. Changes to those components belong in their upstream repositories.
- **Configuration changes** for Nitro React go in `nitro/configuration/`, not inside `nitro/nitro-react/`.
- **Emulator configuration** lives exclusively in `emulator/config.ini`.
- **CMS configuration** is handled through environment variables in `docker-compose.yaml`.
- The default SSO ticket is `123`. It is seeded by the SQL dump in `mysql/dumps/`.
- All `just` commands assume the Docker containers are already running unless noted otherwise.
