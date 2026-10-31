# 🎉 Pop Quiz

A real-time, multiplayer birthday quiz. The **admin** builds quizzes and hosts the game from a
laptop or TV. **Gamers** pick a name on their phones and play along live. The host unlocks the
questions one at a time and everyone moves together.

## Features

**Admin** (password `9999` by default)

- Create, edit and delete quizzes. Enable a quiz to make it visible to players.
- Add questions of 8 types. Any question can have a picture.

  | Type             | How it works                                      |
  | ---------------- | ------------------------------------------------- |
  | Multiple choice  | Pick the one correct answer                       |
  | Multi-select     | Several answers can be correct                    |
  | True / False     | Is the statement true?                            |
  | Picture answers  | Pick the right picture                            |
  | Type the answer  | Free text (ignores case, accents and punctuation) |
  | Put in order     | Drag items into the right order                   |
  | Guess the number | Correct within a tolerance (e.g. ±2)              |
  | Poll             | Just for fun, no right answer                     |

- Drag and drop to reorder questions. You can also edit, duplicate or delete them.
- Host screen with a live lobby, Start, Back/Next, Reveal answer and Finish buttons, a live
  answer chart, and who has answered.
- Results for every game played: a podium, the leaderboard, each player's answers and
  per-question stats. The quiz list shows how many people have played each quiz.

**Gamers** (no password)

- Pick a username and see the games that are open right now. The list updates live.
- Wait in the lobby until the host starts, then answer each question as the host unlocks it.
  Gamers can't skip ahead or go back on their own.
- Answers are saved on the server as soon as they're sent. Correct answers earn the question's
  points.
- If you close the browser and come back, you're logged in again automatically and returned to
  the current question.
- Sounds, vibration and confetti on game start, on each new question, on reveal and at the
  winner's podium.

## Tech stack

| Part     | Tech                                                             |
| -------- | ---------------------------------------------------------------- |
| Frontend | Angular 22 (standalone, signals), SCSS, Angular CDK drag & drop  |
| Backend  | NestJS 12, Socket.IO, Prisma 7 + SQLite                          |
| Shared   | `@pop-quiz/shared`: question types, scoring, socket events, DTOs |
| Tests    | Vitest (unit + backend e2e), Playwright (full browser flow)      |

```text
frontend/   Angular app
backend/    NestJS API + Socket.IO gateway + Prisma (SQLite)
shared/     Types and logic used by both
e2e/        Playwright test that plays a whole game
```

## Getting started

Requirements: Node.js 22+ and npm 11+.

```bash
npm install
npm run dev        # backend on :3000 + frontend on :4200
```

Open <http://localhost:4200>. The SQLite database (`backend/prisma/dev.db`) is created
automatically on first start.

### Playing on phones (same Wi-Fi)

```bash
npm run dev:lan
```

Then open `http://<your-computer-ip>:4200` on the phones. On Windows, `ipconfig` shows your IP.

### Commands

Run these from the repo root:

| Command            | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Backend + frontend with live reload               |
| `npm run dev:lan`  | Same, reachable from other devices on the network |
| `npm test`         | All unit tests (shared, backend, frontend)        |
| `npm run test:e2e` | Backend end-to-end game flow (HTTP + sockets)     |
| `npm run e2e`      | Builds everything and runs the Playwright test    |
| `npm run build`    | Production build of all packages                  |

You can also run these from `frontend/`:

| Command           | What it does                |
| ----------------- | --------------------------- |
| `npm run fe`      | Frontend only (`ng serve`)  |
| `npm run be`      | Backend only (watch mode)   |
| `npm run dev`     | Both                        |
| `npm run dev:lan` | Both, reachable on your LAN |

To save screenshots of every screen while the Playwright test runs, set `E2E_SCREENSHOTS=1`.
They go to `test-results/screens/`.

## Configuration

The backend reads these environment variables (see `backend/.env.example`):

| Variable         | Default               | Purpose                        |
| ---------------- | --------------------- | ------------------------------ |
| `PORT`           | `3000`                | HTTP + WebSocket port          |
| `ADMIN_PASSWORD` | `9999`                | Admin login password           |
| `JWT_SECRET`     | `pop-quiz-dev-secret` | Signs admin tokens. Change it! |
| `DATABASE_URL`   | `file:prisma/dev.db`  | SQLite file                    |
| `UPLOADS_DIR`    | `uploads`             | Where uploaded pictures go     |

## Production

```bash
npm run build
cd backend && npm run start:prod
```

The backend serves the built Angular app, the API (`/api`), uploaded pictures (`/uploads`) and
Socket.IO on a single port.
