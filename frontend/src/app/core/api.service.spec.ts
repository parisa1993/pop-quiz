import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { trueFalseQuestion } from '../../testing/test-helpers';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function expectCall<T>(
    call: Promise<T>,
    method: string,
    url: string,
    response: unknown,
    body?: unknown,
  ): Promise<T> {
    const req = http.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(response as object | null);
    return call;
  }

  it('logs the admin in', async () => {
    expect(
      await expectCall(
        api.adminLogin('9999'),
        'POST',
        '/api/admin/login',
        { token: 't' },
        { password: '9999' },
      ),
    ).toBe('t');
  });

  it('manages quizzes', async () => {
    await expectCall(api.listQuizzes(), 'GET', '/api/admin/quizzes', []);
    await expectCall(api.getQuiz('z'), 'GET', '/api/admin/quizzes/z', {});
    await expectCall(
      api.createQuiz({ title: 'T' }),
      'POST',
      '/api/admin/quizzes',
      {},
      { title: 'T' },
    );
    await expectCall(
      api.updateQuiz('z', { enabled: true }),
      'PATCH',
      '/api/admin/quizzes/z',
      {},
      { enabled: true },
    );
    await expectCall(api.deleteQuiz('z'), 'DELETE', '/api/admin/quizzes/z', null);
  });

  it('manages questions', async () => {
    const { id, quizId, order, ...input } = trueFalseQuestion;
    await expectCall(
      api.createQuestion('z', input),
      'POST',
      '/api/admin/quizzes/z/questions',
      {},
      input,
    );
    await expectCall(api.updateQuestion('q', input), 'PATCH', '/api/admin/questions/q', {}, input);
    await expectCall(api.deleteQuestion('q'), 'DELETE', '/api/admin/questions/q', null);
    await expectCall(
      api.reorderQuestions('z', ['b', 'a']),
      'PUT',
      '/api/admin/quizzes/z/questions/order',
      [],
      { ids: ['b', 'a'] },
    );
    expect([id, quizId, order]).toBeTruthy();
  });

  it('uploads images as form data', async () => {
    const call = api.uploadImage(new Blob(['x'], { type: 'image/png' }), 'a.png');
    const req = http.expectOne('/api/admin/uploads');
    expect(req.request.body).toBeInstanceOf(FormData);
    req.flush({ url: '/uploads/a.png' });
    expect(await call).toBe('/uploads/a.png');
  });

  it('handles sessions and results', async () => {
    await expectCall(api.openSession('z'), 'POST', '/api/admin/quizzes/z/sessions', {});
    await expectCall(api.listSessions('z'), 'GET', '/api/admin/quizzes/z/sessions', []);
    await expectCall(api.getResults('s'), 'GET', '/api/admin/sessions/s/results', {});
  });

  it('handles gamers', async () => {
    await expectCall(
      api.createPlayer('Ana'),
      'POST',
      '/api/players',
      { id: 'p' },
      { username: 'Ana' },
    );
    await expectCall(api.getPlayer('p'), 'GET', '/api/players/p', { id: 'p' });
    await expectCall(api.listGames(), 'GET', '/api/games', []);
    expect(
      await expectCall(
        api.joinGame('z', 'p'),
        'POST',
        '/api/games/z/join',
        { sessionId: 's' },
        { playerId: 'p' },
      ),
    ).toBe('s');
  });
});
