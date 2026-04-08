# Cadence Metronome Web

A minimal cadence metronome built with React, TypeScript, and Vite.

It provides a single-screen metronome UI for running and training drills, with responsive layout support for both desktop and mobile browsers.

## Preview

[cadence-metronome-web.vercel.app](https://cadence-metronome-web.vercel.app/)

## Features

- Cadence selector from `60` to `220` BPM in `5 BPM` steps
- Single `Start` / `Stop` toggle button
- `15` built-in cue sounds:
  `Click`, `Beep`, `Clap`, `Tick`, `Woodblock`, `Rim`, `Hi-Hat`, `Cowbell`, `Shaker`, `Clave`, `Bell`, `Pulse`, `Low Tone`, `High Tone`, `Snap`
- Live cadence readout with beat interval in milliseconds
- Lightweight visual beat indicator
- Recovery-oriented audio error messages for mobile/browser autoplay restrictions
- Responsive single-card layout with safe-area support and reduced-motion handling
- PWA support with installable app metadata and offline-ready app shell caching

## Tech Stack

- React `19`
- TypeScript
- Vite
- Web Audio API
- Service Worker
- Web App Manifest
- Biome

## How It Works

- Audio is generated in code with the Web Audio API.
- Cue sounds are synthesized into in-memory `AudioBuffer`s at startup.
- Playback uses `setInterval` with `60000 / BPM` timing.
- Changing cadence while playing restarts the interval with the new BPM.
- Changing cue while playing applies on the next beat.

## PWA

- The app includes a web app manifest for installability on Android, desktop Chrome, and other supported browsers.
- A service worker caches the app shell and static assets so the UI can reopen after the first successful online load.
- Apple touch icons and PWA icons are included for home screen installation.
- Audio is still generated at runtime with the Web Audio API, so PWA support focuses on installability and offline app access rather than downloading sound files.

## Development

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

Create a production build:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

Run formatting and checks:

```bash
pnpm check
```

## Project Structure

```text
.
├── doc/
│   └── task.md
├── public/
│   ├── apple-touch-icon.png
│   ├── manifest.webmanifest
│   ├── pwa-192.png
│   ├── pwa-512.png
│   ├── favicon.svg
│   └── sw.js
├── src/
│   ├── audio/
│   │   └── metronome.ts
│   ├── components/
│   │   ├── BPMControl.tsx
│   │   ├── PlayerControls.tsx
│   │   └── SoundSelector.tsx
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

## Notes

- No external sound files are required right now; all cues are synthesized in `src/audio/metronome.ts`.
- On mobile Safari and some browsers, audio may require an explicit user interaction before playback starts. If audio fails, the app shows a recovery hint in the UI.
- Service worker updates follow the normal browser lifecycle, so a freshly deployed version may appear after refresh or when the old worker is replaced.
