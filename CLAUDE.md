# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

**Pop Quiz** is a real-time multiplayer quiz app built for a friend's birthday. The admin builds
quizzes and hosts the game on a big screen. Gamers join from their phones with only a username.
The host unlocks questions one by one, and everyone follows in lockstep over WebSockets.

It should look **great**: festive, stylish, polished, and fully responsive.

> Features are specified by the user step by step. Don't invent features or game rules. If
> something is unclear, ask before building it.

## Tech stack

| Layer    | Tech                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| Frontend | Angular 22 (standalone components, signals, `@if`/`@for` control flow, `inject()`), SCSS, Vitest |
| Realtime | Socket.IO (`socket.io-client` on the FE, `@nestjs/platform-socket.io` on the BE)                 |
| Backend  | NestJS 12 (ESM), Prisma 7 + SQLite (`better-sqlite3` adapter), Vitest                            |
| Shared   | `@pop-quiz/shared`: question types, validation, scoring, socket events, DTOs                     |
| E2E      | Playwright (`e2e/`), backend game-flow test (`backend/test/`)                                    |

## Repository layout

npm workspaces:

```text
shared/     @pop-quiz/shared: built to dist/ (run `npm run build:shared` after changing it)
backend/    NestJS app: src/{auth,quizzes,players,uploads,games,prisma}, prisma/schema.prisma
frontend/   Angular app: src/app/{core,shared,features/{home,play,admin}}, src/styles/
e2e/        Playwright full-game test
```

## Commands

```bash
npm run dev            # backend :3000 + frontend :4200 (proxy for /api, /uploads, /socket.io)
npm run dev:lan        # same, reachable from phones on the Wi-Fi
npm test               # shared + backend + frontend unit tests
npm run test:e2e       # backend HTTP + socket game-flow test
npm run e2e            # build + Playwright (E2E_SCREENSHOTS=1 saves screens)
npm run build
cd backend && npx prisma migrate dev --name <change>   # after editing schema.prisma
```

## Domain rules

- Roles: **admin** (password `ADMIN_PASSWORD`, default `9999`, gets a JWT) and **gamer**
  (username only, remembered in localStorage).
- Only `enabled` quizzes with at least one question are visible to gamers.
- A quiz has at most one active session (`LOBBY` → `IN_PROGRESS` → `FINISHED`). Gamers joining
  create the lobby if there isn't one.
- Only the host moves forward or back, and reveals answers. Gamers answer the current question
  only, once, until it's revealed.
- **Flat scoring**: a correct answer earns the question's `points` (default 100). Polls earn 0.
  There is no timer.
- Editing questions or deleting a quiz is blocked while that quiz is `IN_PROGRESS`.

## Backend conventions

- `GameGateway` only does socket I/O. `SessionsService` owns state transitions and snapshots, and
  `RealtimeService` pushes them.
- The server is the source of truth: grading happens with `gradeAnswer` from shared, and payloads
  are checked with `isValidAnswerPayload`.
- After every change, broadcast full snapshots: `game:state` (personal, per gamer) and
  `host:state` (to the admin). Never send correct answers to gamers before reveal (use
  `toPublicQuestion`).
- Imports use `.js` extensions (ESM, `nodenext`). Unit tests use a real temp SQLite DB through
  `src/testing/test-db.ts`.

## Frontend conventions

- Standalone components, `ChangeDetectionStrategy.OnPush`, signals for state, `inject()`.
- Talk to the backend only through `core/api.service.ts` and `core/socket.service.ts`. Pages
  re-join on `socket.connected()`.
- Feature folders live under `src/app/features/`. Reusable UI goes in `src/app/shared/`.
- Spec helpers (`FakeSocket`, `createApiMock`, fixtures) are in `src/testing/test-helpers.ts`.

## Design & UX guidelines

- **Mobile-first and responsive.** Players use phones; the host view is for a laptop or TV.
- Design tokens are in `src/styles/_tokens.scss`, and shared classes (`.btn`, `.card`, `.input`,
  `.badge`, …) are in `src/styles/_components.scss`. Use them instead of hard-coded values.
- Festive look: party gradient, Fredoka/Nunito, answer tiles with colour + shape, and confetti.
  Respect `prefers-reduced-motion`.
- Accessibility: contrast, touch targets of at least 44px, focus states, labels on every input.
- No heavy UI library. Use handcrafted SCSS and Angular CDK (drag & drop only).

## Code style & quality

- Prettier: 100-column width, single quotes. Strict TypeScript.
- **Every source file gets a matching `*.spec.ts`.**
- Before calling work done, run `npm test`, `npm run test:e2e` and `npm run build`. Run
  `npm run e2e` for UI changes.

## Gotchas

- npm 12 blocks install scripts. Native/CLI packages are allow-listed in the root `package.json`
  (`allowScripts`). If you add one, run `npm install-scripts approve <pkg>`.
- `@pop-quiz/shared` is consumed from `dist/`. Change it, then `npm run build:shared` (the root
  `dev`/`test` scripts do this for you).
- Prisma's client is a proxy: `instanceof PrismaService` is false, so check behaviour in tests.
- On Windows, SQLite files stay locked briefly after disconnect. Cleanup code must tolerate that.
- Angular templates can't contain arrow functions. Add a component method instead.
- The Playwright config is loaded by every worker, so share per-run state through env vars.

## Workflow

- The user describes each feature. Confirm the scope before implementing large pieces.
- Work on a feature branch. The user asked for commits + pushes step by step.
- GitHub: `parisa1993/pop-quiz` (public), default branch `main`.
