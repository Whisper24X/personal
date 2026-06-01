import { JwtService } from '@nestjs/jwt';
import type ms from 'ms';
import request from 'supertest';
import { APP_URL } from './constants';

const DEFAULT_PASSWORD = 'secret';

type TestSession = {
  username: string;
  password: string;
  nickname: string;
  token: string;
  refreshToken: string;
  loginToken: string;
  user: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
};

const uniqueSuffix = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getJwtService = (): JwtService => {
  const secret = process.env.AUTH_JWT_SECRET;

  if (!secret) {
    throw new Error('AUTH_JWT_SECRET is not configured for e2e tests');
  }

  return new JwtService({ secret });
};

const getTokenExpiresIn = (): ms.StringValue =>
  (process.env.AUTH_JWT_TOKEN_EXPIRES_IN ?? '1h') as ms.StringValue;

export const createRegisteredUser = async ({
  app = APP_URL,
  username = `user.${uniqueSuffix()}`,
  password = DEFAULT_PASSWORD,
  nickname = `User ${uniqueSuffix()}`,
  roles = ['user'],
}: {
  app?: string;
  username?: string;
  password?: string;
  nickname?: string;
  roles?: string[];
} = {}): Promise<TestSession> => {
  await request(app)
    .post('/api/v1/auth/email/register')
    .send({
      username,
      password,
      nickname,
    })
    .expect(204);

  const response = await request(app)
    .post('/api/v1/auth/email/login')
    .send({ username, password })
    .expect(200);

  const loginToken = response.body.token as string;
  const refreshToken = response.body.refreshToken as string;
  const user = response.body.user as TestSession['user'];
  const token =
    roles.length === 1 && roles[0] === 'user'
      ? loginToken
      : getJwtService().sign(
          {
            sub: user.id,
            username: user.username,
            roles,
          },
          {
            expiresIn: getTokenExpiresIn(),
          },
        );

  return {
    username,
    password,
    nickname,
    token,
    refreshToken,
    loginToken,
    user,
  };
};

export const createAdminSession = async (app = APP_URL): Promise<TestSession> =>
  createRegisteredUser({
    app,
    username: `admin.${uniqueSuffix()}`,
    nickname: `Admin ${uniqueSuffix()}`,
    roles: ['admin'],
  });
