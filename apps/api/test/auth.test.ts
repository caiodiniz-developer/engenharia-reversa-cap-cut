import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerUser, startTestApp, type TestApp } from './harness';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.close());

describe('autenticação', () => {
  it('cadastra, entra e consulta o perfil', async () => {
    const u = await registerUser(t, 'Maria');
    const me = await u.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: u.email, name: 'Maria' });
    expect(me.body.user.passwordHash).toBeUndefined();

    const login = await t.http.post('/api/auth/login').send({ email: u.email, password: 'senha-forte-123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('rejeita e-mail duplicado, senha curta e e-mail inválido', async () => {
    const u = await registerUser(t);
    expect((await t.http.post('/api/auth/register').send({ email: u.email, password: 'senha-forte-123', name: 'x' })).status).toBe(409);
    expect((await t.http.post('/api/auth/register').send({ email: 'a@b.com', password: '123', name: 'x' })).status).toBe(400);
    const bad = await t.http.post('/api/auth/register').send({ email: 'nao-e-email', password: 'senha-forte-123', name: 'x' });
    expect(bad.status).toBe(400);
    expect(bad.body.details[0].path).toBe('email');
  });

  it('login com senha errada ou usuário inexistente dá a mesma resposta 401', async () => {
    const u = await registerUser(t);
    const wrong = await t.http.post('/api/auth/login').send({ email: u.email, password: 'senha-errada-123' });
    const none = await t.http.post('/api/auth/login').send({ email: 'ninguem@example.com', password: 'senha-errada-123' });
    expect(wrong.status).toBe(401);
    expect(none.status).toBe(401);
    expect(wrong.body.error).toBe(none.body.error);
  });

  it('exige token válido', async () => {
    expect((await t.http.get('/api/auth/me')).status).toBe(401);
    expect((await t.http.get('/api/auth/me').set('Authorization', 'Bearer lixo')).status).toBe(401);
    expect((await t.http.get('/api/projects')).status).toBe(401);
  });

  it('atualiza preferências do usuário', async () => {
    const u = await registerUser(t);
    const r = await u.patch('/api/auth/settings').send({ language: 'pt-BR', autosaveSeconds: 10 });
    expect(r.status).toBe(200);
    expect(r.body.user.settings).toMatchObject({ language: 'pt-BR', autosaveSeconds: 10 });
    expect((await u.patch('/api/auth/settings').send({ autosaveSeconds: 1 })).status).toBe(400);
  });

  it('aplica rate limit nas rotas de credenciais', async () => {
    const limited = await startTestApp({ env: { AUTH_RATE_LIMIT_PER_MINUTE: 3 } });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) codes.push((await limited.http.post('/api/auth/login').send({ email: 'a@b.com', password: 'x'.repeat(8) })).status);
      expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
      expect(codes.slice(3)).toEqual([429, 429]);
    } finally {
      await limited.close();
    }
  });

  it('envia cabeçalhos de segurança e não expõe x-powered-by', async () => {
    const r = await t.http.get('/api/health');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  it('CORS permite apenas origens configuradas', async () => {
    const ok = await t.http.get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await t.http.get('/api/health').set('Origin', 'http://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
