# SyncClient

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="SyncClient Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Cross-platform file sync client powered by rclone</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#development">Development</a> •
  <a href="#building">Building</a> •
  <a href="#releases">Releases</a>
</p>

---

## Overview

SyncClient is a lightweight, cross-platform desktop application that provides an intuitive graphical interface for [rclone](https://rclone.org/) — the powerful command-line tool that supports 70+ cloud storage providers. Manage your cloud remotes, create sync tasks, preview file differences, and monitor transfer progress — all within a modern, responsive UI.

## Features

### Cloud Configuration Management
- Create, edit, and manage multiple rclone remotes (S3, OneDrive, Google Drive, SFTP, WebDAV, and more)
- Import existing `rclone.conf` files or export your configurations for backup
- Test remote connections with a single click
- Browse remote file trees directly within the app

### Sync Task Management
- Create sync tasks with local directory + remote path + direction rules
- Three sync directions: bidirectional (bisync), upload only, download only
- Enable/disable tasks and organize them with custom names
- Task-level include/exclude filters using glob/regex patterns
- Manual one-click sync trigger

### Diff Preview & Selective Sync
- Scan for differences before syncing to avoid unwanted changes
- Visual diff view categorized by: Added, Modified, Deleted, Conflict
- Review file metadata (size, modification time) side-by-side
- Select or deselect individual files for each sync run

### Real-time Progress & Logs
- Live transfer progress with speed, percentage, and ETA
- Detailed sync logs with DEBUG/INFO/WARN/ERROR levels
- Historical sync records with transfer statistics
- Export logs for troubleshooting

### System Integration
- System tray support — minimize to tray and keep syncing in the background
- Tray icon context menu for quick actions
- Close button minimizes to tray instead of exiting

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Tauri v2 (Rust + WebView) |
| Frontend | React 19 + TypeScript |
| UI Components | shadcn/ui + TailwindCSS v4 |
| State Management | Zustand |
| Sync Engine | rclone (RC API) |
| File Watching | notify (Rust crate) |
| Database | SQLite (via rusqlite) |
| Bundler | Tauri Bundler (MSI / NSIS / DMG) |

## Installation

### Download Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/king-jingxiang/sync-client/releases) page.

| Platform | Installer |
|----------|-----------|
| Windows (x64) | `.msi` or `.exe` (NSIS setup) |
| macOS (Intel & Apple Silicon) | `.dmg` |

> **Note:** The application requires [rclone](https://rclone.org/downloads/) to be installed on your system, or you can place the `rclone` binary alongside the application executable.

### System Requirements

- **Windows:** Windows 10 or later (x64)
- **macOS:** macOS 12 or later (Intel & Apple Silicon)
- **rclone:** v1.68 or later (recommended)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [Rust](https://rustup.rs/) >= 1.77
- [rclone](https://rclone.org/downloads/) installed and available in PATH

### Setup

```bash
# Clone the repository
git clone https://github.com/king-jingxiang/sync-client.git
cd sync-client

# Install frontend dependencies
npm install

# Run in development mode (starts Vite dev server + Tauri app)
npm run tauri dev
```

### Project Structure

```
sync-client/
├── src/                    # Frontend source (React + TypeScript)
│   ├── components/         # UI components
│   ├── pages/              # Page components
│   ├── stores/             # Zustand state stores
│   ├── lib/                # Utilities & API bindings
│   └── App.tsx             # Root component
├── src-tauri/              # Tauri Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── services/       # Business services
│   │   ├── models/         # Data structures
│   │   ├── db/             # SQLite database layer
│   │   └── lib.rs          # Application entry
│   ├── icons/              # App icons
│   └── Cargo.toml
├── migrations/             # Database migration scripts
└── package.json
```

## Building

### Build Frontend Only

```bash
npm run build
```

### Build Full Application

```bash
npx tauri build
```

Build artifacts will be located at:

```
src-tauri/target/release/bundle/
├── msi/          # Windows MSI installer
├── nsis/         # Windows NSIS installer
└── dmg/          # macOS DMG (on macOS only)
```

### Cross-platform Build via GitHub Actions

This project includes a GitHub Actions workflow that automatically builds and releases for Windows and macOS. See [`.github/workflows/release.yml`](.github/workflows/release.yml) for details.

## Releases

Releases are published automatically via GitHub Actions when a new tag is pushed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow will build for all supported platforms and attach the install packages to the GitHub Release.

## Roadmap

- [x] Basic remote configuration management
- [x] Sync task CRUD
- [x] Diff scanning and preview
- [x] Real-time sync progress
- [x] System tray integration
- [ ] Auto-scheduling (interval / cron)
- [ ] Local file system watcher with auto-sync
- [ ] Conflict resolution strategies
- [ ] Auto-updater
- [ ] Theme switching (light / dark)

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgements

- [rclone](https://rclone.org/) — The powerful sync engine behind this app
- [Tauri](https://v2.tauri.app/) — Modern cross-platform desktop framework
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful, accessible UI components
