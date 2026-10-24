import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { HttpError, h, json, parse, requireAuth, type AppContext } from '../http';
import { hashPassword, signToken, verifyPassword } from '../security';

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres').max(200),
});

const Register = Credentials.extend({ name: z.string().trim().min(1).max(100) });

const Settings = z.object({
  language: z.string().max(10).optional(),
  autosaveSeconds: z.number().min(2).max(300).optional(),
  uploadConsent: z.boolean().optional(),
  aiConsent: z.boolean().optional(),
});

const publicUser = (u: { id: string; email: string; name: string; settings: unknown }) => ({ id: u.id, email: u.email, name: u.name, settings: u.settings });

export function authRoutes(ctx: AppContext): Router {
  const r = Router();
  // Limite mais rígido contra força bruta nas rotas de credenciais.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: ctx.config.AUTH_RATE_LIMIT_PER_MINUTE,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Aguarde um minuto.', code: 'rate_limited' },
  });

  r.post(
    '/register',
    limiter,
    h(async (req, res) => {
      const body = parse(Register, req.body);
      const exists = await ctx.db.user.findUnique({ where: { email: body.email } });
      if (exists) throw new HttpError(409, 'E-mail já cadastrado', 'email_taken');
      const user = await ctx.db.user.create({ data: { email: body.email, name: body.name, passwordHash: await hashPassword(body.password) } });
      res.status(201).json({ token: signToken(user.id, ctx.config.jwtSecret), user: publicUser(user) });
    }),
  );

  r.post(
    '/login',
    limiter,
    h(async (req, res) => {
      const body = parse(Credentials, req.body);
      const user = await ctx.db.user.findUnique({ where: { email: body.email } });
      // Mesma resposta para usuário inexistente e senha errada (evita enumeração de contas).
      const ok = user ? await verifyPassword(body.password, user.passwordHash) : (await hashPassword(body.password), false);
      if (!user || !ok) throw new HttpError(401, 'E-mail ou senha inválidos', 'invalid_credentials');
      res.json({ token: signToken(user.id, ctx.config.jwtSecret), user: publicUser(user) });
    }),
  );

  r.get(
    '/me',
    requireAuth(ctx.config),
    h(async (req, res) => {
      const user = await ctx.db.user.findUnique({ where: { id: req.userId } });
      if (!user) throw new HttpError(401, 'Não autenticado', 'unauthenticated');
      res.json({ user: publicUser(user) });
    }),
  );

  r.patch(
    '/settings',
    requireAuth(ctx.config),
    h(async (req, res) => {
      const patch = parse(Settings, req.body);
      const user = await ctx.db.user.findUnique({ where: { id: req.userId } });
      if (!user) throw new HttpError(401, 'Não autenticado', 'unauthenticated');
      const settings = { ...(user.settings as object), ...patch };
      const updated = await ctx.db.user.update({ where: { id: user.id }, data: { settings } });
      res.json(json({ user: publicUser(updated) }));
    }),
  );

  return r;
}
