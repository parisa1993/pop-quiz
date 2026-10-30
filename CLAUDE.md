# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

**Pop Quiz** is a real-time multiplayer quiz app built for a friend's birthday. A host runs the
game (often on a big screen) and players join from their phones. Everyone sees live updates
(players joining, answers coming in, scores, leaderboard) over WebSockets.

It should look **great**: festive, stylish, polished, and fully responsive.

> Features are specified by the user step by step. Don't invent features or game rules. If
> something is unclear, ask before building it.

## Tech stack

| Layer    | Tech                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| Frontend | Angular 22 (standalone components, signals, `@if`/`@for` control flow, `inject()`), SCSS, Vitest |
| Realtime | Socket.IO (`socket.io-client` on the FE, `@nestjs/platform-socket.io` on the BE)                 |
| Backend  | NestJS (`@nestjs/websockets` gateways + services), TypeScript                                    |
| Shared   | `shared/`: TypeScript event names and payload types used by both FE and BE                       |
| Storage  | In-memory game state for now. Don't add a database unless asked.                                 |

## Repository layout (target)

```text
frontend/   Angular app
backend/    NestJS app
shared/     socket event names + payload/DTO types (imported by both)
```

**Current state:** the Angular app is still scaffolded at the repo root (`src/`, `angular.json`).
It will move into `frontend/` when backend work starts. Until then, run Angular commands from the
root.

## Commands

Current (Angular at the repo root):

```bash
npm start                    # ng serve → http://localhost:4200
npm run build                # production build
npm test                     # Vitest unit tests
npx ng generate component features/<name>/<name>
```

Planned (after the split):

```bash
cd frontend && npm start         # FE on :4200
cd backend && npm run start:dev  # BE on :3000 (HTTP + Socket.IO)
```

## Frontend conventions

- Standalone components only, no NgModules. Use `ChangeDetectionStrategy.OnPush`.
- State lives in **signals** (`signal`, `computed`, `effect`). Use RxJS only where streams make sense.
- Use `inject()` instead of constructor injection.
- A single `SocketService` wraps Socket.IO: it connects, reconnects, and exposes typed events as
  signals/observables. Components never touch the raw socket.
- Organize by feature: `src/app/features/<feature>/`, with shared UI in `src/app/shared/`.
- Use typed event names and payloads from `shared/`. Don't use string literals for events.

## Backend conventions

- The **gateway** only handles socket I/O. Game logic (rooms, questions, timers, scoring) lives in
  **services**.
- Each game is a Socket.IO **room** keyed by a short join code.
- The **server is the source of truth** for question order, timers and scoring. Never trust
  scores or timing sent by a client.
- Validate every incoming payload (class-validator DTOs or equivalent).
- Handle disconnect and reconnect gracefully: a player can rejoin with the same session id/name
  without losing their score.

## Real-time rules

- Event names are constants in `shared/events.ts`. Payload types live next to them.
- After every state change, broadcast a consistent **state snapshot** to the room, rather than
  scattered partial updates the client has to stitch together.
- Keep the UI optimistic only for purely cosmetic feedback. Scores and results come from the
  server.

## Design & UX guidelines

- **Mobile-first and responsive.** Players use phones; the host view may be on a laptop or TV.
  Test at ~375px, tablet and desktop widths.
- **Festive and stylish**: a birthday theme with bold color, playful typography and delightful
  micro-interactions (confetti on correct answers or the winner, animated leaderboard).
- Put design tokens (colors, spacing, radii, fonts, shadows) in CSS custom properties in
  `src/styles.scss`. Components use the tokens, not hard-coded values.
- Keep animations smooth but restrained, and respect `prefers-reduced-motion`.
- Accessibility: good contrast, touch targets of at least 44px, visible focus states, semantic HTML.
- Don't add a heavy UI component library unless the user agrees. Handcrafted SCSS is preferred.
- Watch the Angular style budgets in `angular.json` (4kB warning per component stylesheet). Put
  shared styles in global partials.

## Code style

- Prettier: 100-column width, single quotes (see `.prettierrc`). Format before committing.
- Strict TypeScript. No `any` unless it's justified.
- Keep components and services small and focused.
- Before calling work done, run the build and the tests.

## Workflow

- The user describes each feature. Confirm the scope before implementing large pieces.
- Commit or push only when asked.
- GitHub repo: `pop-quiz` (public), default branch `main`.
