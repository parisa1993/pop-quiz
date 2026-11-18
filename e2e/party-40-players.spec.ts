import { Browser, devices, expect, Page, test } from '@playwright/test';
import { ClientEvents } from '@pop-quiz/shared';
import { io, Socket } from 'socket.io-client';

/**
 * A full party with 40 players: the host drives the game in a real browser, 2 guests play on
 * real phone-sized browsers, and 38 simulated guests play over live socket connections.
 */
const BOTS = 38;
const PLAYERS = BOTS + 2;
const QUIZ = 'Big Party Quiz';

interface Bot {
  index: number;
  socket: Socket;
}

async function api<T>(
  base: string,
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(base + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body as T;
}

async function phone(browser: Browser, base: string, name: string): Promise<Page> {
  const page = await (await browser.newContext({ ...devices['Pixel 7'], baseURL: base })).newPage();
  await page.goto('/play/name');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: `Join ${QUIZ}` }).click();
  await expect(page.getByText(`You're in, ${name}!`)).toBeVisible();
  return page;
}

test('40 guests play a whole game while the host runs it', async ({
  page: admin,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const base = baseURL!;
  const bots: Bot[] = [];

  // ---------- The admin prepares a quiz (via the API; the editor has its own test) ----------
  const { token } = await api<{ token: string }>(base, '/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: '9999' }),
  });
  const quiz = await api<{ id: string }>(
    base,
    '/api/admin/quizzes',
    { method: 'POST', body: JSON.stringify({ title: QUIZ, enabled: true }) },
    token,
  );
  const add = (q: object) =>
    api(
      base,
      `/api/admin/quizzes/${quiz.id}/questions`,
      { method: 'POST', body: JSON.stringify(q) },
      token,
    );
  await add({
    type: 'SINGLE_CHOICE',
    text: 'Favourite colour?',
    points: 100,
    config: {
      options: [
        { id: 'a', text: 'Pink' },
        { id: 'b', text: 'Blue' },
        { id: 'c', text: 'Gold' },
      ],
      correctOptionId: 'c',
    },
  });
  await add({
    type: 'TYPE_ANSWER',
    text: 'Previous dog?',
    points: 200,
    config: { acceptedAnswers: ['Buba'] },
  });
  await add({
    type: 'TRUE_FALSE',
    text: 'Chiara has a dog called Milo',
    points: 100,
    config: { correct: true },
    funFact: 'Milo is a very good boy.',
  });
  const { questions } = await api<{ questions: { id: string; type: string }[] }>(
    base,
    `/api/admin/quizzes/${quiz.id}`,
    {},
    token,
  );

  // ---------- The host opens the game in the browser ----------
  await admin.goto('/admin/login');
  await admin.getByLabel('Password').fill('9999');
  await admin.getByRole('button', { name: 'Log in' }).click();
  await admin
    .getByRole('article')
    .filter({ hasText: QUIZ })
    .getByRole('button', { name: /Host game/ })
    .click();
  await expect(admin.getByText('Waiting for the first player')).toBeVisible();

  // ---------- 38 guests join over sockets, 2 on real phones ----------
  const joinBot = async (index: number): Promise<Bot> => {
    const player = await api<{ id: string }>(base, '/api/players', {
      method: 'POST',
      body: JSON.stringify({ username: `Bot ${String(index + 1).padStart(2, '0')}` }),
    });
    const { sessionId } = await api<{ sessionId: string }>(base, `/api/games/${quiz.id}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerId: player.id }),
    });
    const socket = io(base, { transports: ['websocket'], forceNew: true });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const ack = await socket
      .timeout(10_000)
      .emitWithAck(ClientEvents.PlayerJoin, { sessionId, playerId: player.id });
    expect(ack.ok).toBe(true);
    (socket as Socket & { sessionId?: string }).sessionId = sessionId;
    return { index, socket };
  };
  bots.push(...(await Promise.all(Array.from({ length: BOTS }, (_, i) => joinBot(i)))));
  const lia = await phone(browser, base, 'Lia');
  const max = await phone(browser, base, 'Max');

  await expect(admin.locator('.lobby__count')).toHaveText(
    new RegExp(`${PLAYERS}\\s*players joined`),
  );
  await expect(lia.getByText(`${PLAYERS} players here`)).toBeVisible();

  // Simulated guests: even bots answer correctly, odd bots answer wrong.
  const botAnswers: Record<string, [object, object]> = {
    SINGLE_CHOICE: [{ optionId: 'c' }, { optionId: 'a' }],
    TYPE_ANSWER: [{ text: 'buba' }, { text: 'Rex' }],
    TRUE_FALSE: [{ value: true }, { value: false }],
  };
  const botsAnswer = async (q: { id: string; type: string }) => {
    const acks = await Promise.all(
      bots.map((b) =>
        b.socket.timeout(10_000).emitWithAck(ClientEvents.PlayerAnswer, {
          sessionId: (b.socket as Socket & { sessionId?: string }).sessionId,
          questionId: q.id,
          payload: botAnswers[q.type][b.index % 2],
        }),
      ),
    );
    expect(acks.every((a) => a.ok)).toBe(true);
  };

  try {
    // ---------- Question 1 ----------
    await admin.getByRole('button', { name: /Start the game/ }).click();
    for (const p of [lia, max]) await expect(p.getByText('Question 1 / 3')).toBeVisible();
    await botsAnswer(questions[0]);
    await lia.getByRole('button', { name: /Gold/ }).click();
    await max.getByRole('button', { name: /Pink/ }).click();
    await expect(admin.getByText(`${PLAYERS} / ${PLAYERS} answered`)).toBeVisible();
    await admin.getByRole('button', { name: /Reveal answer/ }).click();
    await expect(lia.getByText('Correct! +100 pts')).toBeVisible();
    await expect(max.getByText('Not quite!')).toBeVisible();

    // ---------- Question 2 ----------
    await admin.getByRole('button', { name: 'Next →' }).click();
    for (const p of [lia, max]) await expect(p.getByText('Question 2 / 3')).toBeVisible();
    await botsAnswer(questions[1]);
    await lia.getByLabel('Your answer').fill('Buba');
    await lia.getByRole('button', { name: /Lock it in/ }).click();
    await max.getByLabel('Your answer').fill('Buba');
    await max.getByRole('button', { name: /Lock it in/ }).click();
    await expect(admin.getByText(`${PLAYERS} / ${PLAYERS} answered`)).toBeVisible();
    await admin.getByRole('button', { name: /Reveal answer/ }).click();
    await expect(max.getByText('Correct! +200 pts')).toBeVisible();

    // The host's player list is ordered by points, highest first.
    const scores = (await admin.locator('.players .players__score').allTextContents()).map(Number);
    expect(scores).toHaveLength(PLAYERS);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(scores[0]).toBe(300);
    await expect(admin.locator('.players li').first()).toContainText(/Lia|Bot/);

    // A phone guest reloads mid-game and is back on the current question.
    await max.reload();
    await expect(max.getByText('Question 2 / 3')).toBeVisible();

    // ---------- Question 3, with a fun fact ----------
    await admin.getByRole('button', { name: 'Next →' }).click();
    for (const p of [lia, max]) await expect(p.getByText('Question 3 / 3')).toBeVisible();
    await botsAnswer(questions[2]);
    await lia.getByRole('button', { name: 'True' }).click();
    await max.getByRole('button', { name: 'True' }).click();
    await expect(admin.getByText(`${PLAYERS} / ${PLAYERS} answered`)).toBeVisible();
    await admin.getByRole('button', { name: /Reveal answer/ }).click();
    await expect(lia.locator('.fun-fact')).toContainText('Milo is a very good boy.');
    await expect(admin.locator('.fun-fact')).toContainText('Milo is a very good boy.');

    // ---------- Finish ----------
    await admin.getByRole('button', { name: /Finish & show winners/ }).click();
    await admin.getByRole('button', { name: 'Finish 🏁' }).click();
    await expect(admin.getByRole('heading', { name: /Winners/ })).toBeVisible();
    await expect(admin.locator('.board li')).toHaveCount(PLAYERS);
    // Lia got everything right (400) and shares first place with the even bots.
    await expect(lia.getByText('You won! 🏆')).toBeVisible();
    await expect(lia.getByText('400 points')).toBeVisible();
    await expect(max.getByText(`of ${PLAYERS}`)).toBeVisible();
  } finally {
    bots.forEach((b) => b.socket.disconnect());
  }
});
