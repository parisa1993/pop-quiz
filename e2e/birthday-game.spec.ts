import { Browser, devices, expect, Locator, Page, test } from '@playwright/test';

const PHONE = devices['Pixel 7'];
const QUIZ_TITLE = 'Birthday Bash';

/** Set E2E_SCREENSHOTS=1 to save a visual tour of every screen to test-results/screens. */
async function shot(page: Page, name: string): Promise<void> {
  if (process.env['E2E_SCREENSHOTS']) await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
}

async function newPhone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...PHONE });
  return context.newPage();
}

/** CDK drag & drop needs real, gradual pointer moves. */
async function dragTo(page: Page, handle: Locator, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(from.x + from.width / 2, from.y + ((to.y + to.height / 2 - from.y) * step) / 12, { steps: 2 });
  }
  await page.mouse.up();
}

async function joinAsGamer(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: /Play the game/ }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: /Let's go/ }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('button', { name: `Join ${QUIZ_TITLE}` }).click();
  await expect(page.getByText(`You're in, ${name}!`)).toBeVisible();
}

test('admin builds a quiz and two gamers play it live from their phones', async ({ page: admin, browser }) => {
  // ---------- Admin logs in ----------
  await admin.goto('/');
  await shot(admin, '01-home');
  await admin.getByRole('link', { name: /Login as admin/ }).click();
  await admin.getByLabel('Password').fill('0000');
  await admin.getByRole('button', { name: 'Log in' }).click();
  await expect(admin.getByRole('alert')).toHaveText('Wrong password');
  await admin.getByLabel('Password').fill('9999');
  await admin.getByRole('button', { name: 'Log in' }).click();
  await expect(admin.getByRole('heading', { name: 'Your quizzes' })).toBeVisible();

  // ---------- Creates a quiz ----------
  await admin.getByRole('link', { name: /Create a quiz/ }).click();
  await admin.getByLabel('Title').fill(QUIZ_TITLE);
  await admin.getByRole('button', { name: /Create quiz/ }).click();
  await expect(admin.getByRole('heading', { name: 'No questions yet' })).toBeVisible();

  // Q: true / false
  await admin.getByRole('button', { name: /Add the first question/ }).click();
  const sheet = admin.getByRole('dialog');
  await sheet.getByRole('button', { name: /True \/ False/ }).click();
  await sheet.getByLabel('Question', { exact: true }).fill('Cake is the best dessert');
  await sheet.getByRole('button', { name: '✔ True' }).click();
  await sheet.getByRole('button', { name: 'Add question' }).click();
  await expect(admin.getByText('Question added')).toBeVisible();

  // Q: multiple choice — saving without a text shows friendly errors first
  await admin.getByRole('button', { name: /Add question/ }).click();
  await sheet.getByRole('button', { name: 'Add question' }).click();
  await expect(sheet.getByRole('alert')).toContainText('Write the question');
  await shot(admin, '03-question-editor');
  await sheet.getByLabel('Question', { exact: true }).fill('Favourite colour?');
  for (const [i, text] of ['Pink', 'Blue', 'Gold', 'Green'].entries()) {
    await sheet.getByLabel(`Answer ${i + 1}`, { exact: true }).fill(text);
  }
  await sheet.getByRole('radio').nth(2).check();
  await sheet.getByRole('button', { name: 'Add question' }).click();
  await expect(admin.getByText('Question added')).toBeVisible();

  // Q: type the answer
  await admin.getByRole('button', { name: /Add question/ }).click();
  await sheet.getByRole('button', { name: /Type the answer/ }).click();
  await sheet.getByLabel('Question', { exact: true }).fill('Name of her cat?');
  await sheet.getByLabel('Accepted answer 1').fill('Miso');
  await sheet.getByRole('button', { name: 'Add question' }).click();
  await expect(admin.locator('.qitem')).toHaveCount(3);

  // Reorder: drag the cat question to the top
  const items = admin.locator('.qitem');
  await dragTo(admin, items.nth(2).getByLabel('Drag to reorder'), items.nth(0));
  await expect(items.nth(0)).toContainText('Name of her cat?');
  await admin.reload();
  await expect(admin.locator('.qitem').nth(0)).toContainText('Name of her cat?');

  // Edit a question from its detail view
  await admin.locator('.qitem').nth(1).getByRole('button', { name: 'Edit question' }).click();
  await sheet.getByLabel('Question', { exact: true }).fill('Cake is the BEST dessert');
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await expect(admin.locator('.qitem').nth(1)).toContainText('Cake is the BEST dessert');
  await shot(admin, '04-quiz-editor');

  // ---------- Gamers can't see it until it's enabled ----------
  const ana = await newPhone(browser);
  await ana.goto('/play/name');
  await ana.getByLabel('Your name').fill('Ana');
  await ana.getByRole('button', { name: /Let's go/ }).click();
  await expect(ana.getByText('No games ready yet')).toBeVisible();
  await shot(ana, '05-phone-no-games');

  await admin.getByRole('button', { name: /Host game/ }).click();
  await expect(admin.getByText('Waiting for the first player')).toBeVisible();

  // Ana's list updates live without a refresh
  await ana.getByRole('button', { name: `Join ${QUIZ_TITLE}` }).click();
  await expect(ana.getByText("You're in, Ana!")).toBeVisible();

  const ben = await newPhone(browser);
  await joinAsGamer(ben, 'Ben');

  await expect(admin.locator('.lobby__count')).toHaveText(/2\s*players joined/);
  await expect(ben.getByText('2 players here')).toBeVisible();
  await shot(ben, '06-phone-lobby');
  await shot(admin, '07-host-lobby');

  // ---------- Game starts: everyone gets question 1 ----------
  await admin.getByRole('button', { name: /Start the game/ }).click();
  for (const phone of [ana, ben]) {
    await expect(phone.getByText('Question 1 / 3')).toBeVisible();
    await expect(phone.getByRole('heading', { name: 'Name of her cat?' })).toBeVisible();
  }

  await shot(ana, '08-phone-type-answer');
  await ana.getByLabel('Your answer').fill('miso!');
  await ana.getByRole('button', { name: /Lock it in/ }).click();
  await expect(ana.getByText('Answer locked in')).toBeVisible();
  await ben.getByLabel('Your answer').fill('Tom');
  await ben.getByRole('button', { name: /Lock it in/ }).click();
  await expect(admin.getByText('2 / 2 answered')).toBeVisible();

  await admin.getByRole('button', { name: /Reveal answer/ }).click();
  await expect(ana.getByText('Correct! +100 pts')).toBeVisible();
  await expect(ben.getByText('Not quite!')).toBeVisible();
  await expect(ben.getByText('Miso', { exact: true })).toBeVisible();
  await shot(ana, '09-phone-correct');
  await shot(ben, '10-phone-wrong');
  await shot(admin, '11-host-revealed');

  // ---------- Next question; Ben closes the app and comes back ----------
  await admin.getByRole('button', { name: 'Next →' }).click();
  await expect(ana.getByText('Question 2 / 3')).toBeVisible();
  await ana.getByRole('button', { name: 'True' }).click();

  await ben.goto('/');
  await expect(ben.getByText('Question 2 / 3')).toBeVisible();
  await ben.getByRole('button', { name: 'False' }).click();
  await expect(admin.getByText('2 / 2 answered')).toBeVisible();

  // Host steps back and forward; players follow and can't skip ahead themselves.
  await admin.getByRole('button', { name: '← Back' }).click();
  await expect(ana.getByText('Question 1 / 3')).toBeVisible();
  await admin.getByRole('button', { name: 'Next →' }).click();
  await expect(ana.getByText('Question 2 / 3')).toBeVisible();
  await admin.getByRole('button', { name: /Reveal answer/ }).click();
  await admin.getByRole('button', { name: 'Next →' }).click();

  // ---------- Last question ----------
  await expect(ben.getByText('Question 3 / 3')).toBeVisible();
  await shot(ana, '12-phone-choice');
  await ana.getByRole('button', { name: /Gold/ }).click();
  await ben.getByRole('button', { name: /Pink/ }).click();
  await admin.getByRole('button', { name: /Reveal answer/ }).click();
  await admin.getByRole('button', { name: /Finish & show winners/ }).click();
  await admin.getByRole('button', { name: 'Finish 🏁' }).click();

  await expect(ana.getByText('You won! 🏆')).toBeVisible();
  await expect(ana.getByText('300 points')).toBeVisible();
  await expect(ben.getByText('You finished #2 of 2')).toBeVisible();
  await expect(admin.getByRole('heading', { name: /Winners/ })).toBeVisible();
  await shot(ana, '13-phone-winner');
  await shot(admin, '14-host-winners');

  // ---------- Results for the admin ----------
  await admin.getByRole('link', { name: 'See full results' }).click();
  const board = admin.locator('.board');
  await expect(board.locator('.board__row').first()).toContainText('Ana');
  await expect(board.locator('.board__row').first()).toContainText('300 pts');
  await board.getByRole('button', { name: /Ben/ }).click();
  await expect(board.getByText('Tom')).toBeVisible();
  await shot(admin, '15-results');

  await admin.getByRole('link', { name: /All quizzes/ }).click();
  await expect(admin.getByText('2 played')).toBeVisible();
  await shot(admin, '02-quiz-list');
});
