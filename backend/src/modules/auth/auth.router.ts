import { Router } from 'express';
import { validateBody } from '@/http/errors';
import { login, refresh, registerHq } from './auth.service';
import { loginSchema, refreshTokenSchema, registerSchema } from '@/modules/shared/validation/schemas';

export const authRouter = Router();

authRouter.post('/auth/register', validateBody(registerSchema), async (request, response) => {
  response.status(201).json(await registerHq(request.body.email, request.body.password, request.body.companyName));
});

authRouter.post('/auth/login', validateBody(loginSchema), async (request, response) => {
  response.status(200).json(await login(request.body.email, request.body.password));
});

authRouter.post('/auth/refresh', validateBody(refreshTokenSchema), async (request, response) => {
  response.status(200).json(await refresh(request.body.refreshToken));
});
