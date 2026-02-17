import request from 'supertest';
import { APP_URL, TESTER_PASSWORD, TESTER_USERNAME } from '../utils/constants';

describe('Auth Module', () => {
  const app = APP_URL;
  const newUserNickname = `Tester${Date.now()}`;
  const newUsername = `user.${Date.now()}`;
  const newUserPassword = 'secret';

  describe('Registration', () => {
    it('should fail with existing username: /api/v1/auth/email/register (POST)', () => {
      return request(app)
        .post('/api/v1/auth/email/register')
        .send({
          username: TESTER_USERNAME,
          password: TESTER_PASSWORD,
          nickname: 'Tester E2E',
        })
        .expect(409);
    });

    it('should succeed: /api/v1/auth/email/register (POST)', () => {
      return request(app)
        .post('/api/v1/auth/email/register')
        .send({
          username: newUsername,
          password: newUserPassword,
          nickname: newUserNickname,
        })
        .expect(204);
    });

    it('should succeed: /api/v1/auth/register (POST)', () => {
      return request(app)
        .post('/api/v1/auth/register')
        .send({
          username: `user.v2.${Date.now()}`,
          password: newUserPassword,
          nickname: `TesterV2${Date.now()}`,
        })
        .expect(204);
    });
  });

  describe('Login', () => {
    it('should succeed: /api/v1/auth/email/login (POST)', () => {
      return request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername, password: newUserPassword })
        .expect(200)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
          expect(body.refreshToken).toBeDefined();
          expect(body.tokenExpires).toBeDefined();
          expect(body.user.username).toBeDefined();
          expect(body.user.password).not.toBeDefined();
        });
    });

    it('should succeed via /api/v1/auth/login (POST)', () => {
      return request(app)
        .post('/api/v1/auth/login')
        .send({ username: newUsername, password: newUserPassword })
        .expect(200)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
          expect(body.user.username).toBeDefined();
        });
    });
  });

  describe('Logged in user', () => {
    let newUserApiToken: string;

    beforeAll(async () => {
      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername, password: newUserPassword })
        .then(({ body }) => {
          newUserApiToken = body.token;
        });
    });

    it('should return own profile: /api/v1/auth/me (GET)', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .auth(newUserApiToken, {
          type: 'bearer',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.username).toBeDefined();
          expect(body.password).not.toBeDefined();
        });
    });

    it('should rotate refresh token: /api/v1/auth/refresh (POST)', async () => {
      let newUserRefreshToken = await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername, password: newUserPassword })
        .then(({ body }) => body.refreshToken);

      newUserRefreshToken = await request(app)
        .post('/api/v1/auth/refresh')
        .auth(newUserRefreshToken, {
          type: 'bearer',
        })
        .expect(200)
        .then(({ body }) => body.refreshToken);

      await request(app)
        .post('/api/v1/auth/refresh')
        .auth(newUserRefreshToken, {
          type: 'bearer',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
          expect(body.refreshToken).toBeDefined();
          expect(body.tokenExpires).toBeDefined();
        });
    });

    it('should keep allowing refresh with same token: /api/v1/auth/refresh (POST)', async () => {
      const refreshToken = await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername, password: newUserPassword })
        .then(({ body }) => body.refreshToken);

      await request(app)
        .post('/api/v1/auth/refresh')
        .auth(refreshToken, {
          type: 'bearer',
        })
        .expect(200);

      await request(app)
        .post('/api/v1/auth/refresh')
        .auth(refreshToken, {
          type: 'bearer',
        })
        .expect(200);
    });

    it('should return no content on logout: /api/v1/auth/logout (POST)', async () => {
      const refreshToken = await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername, password: newUserPassword })
        .then(({ body }) => body.refreshToken);

      const token = await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername, password: newUserPassword })
        .then(({ body }) => body.token);

      await request(app)
        .post('/api/v1/auth/logout')
        .auth(token, {
          type: 'bearer',
        })
        .expect(204);

      await request(app)
        .post('/api/v1/auth/refresh')
        .auth(refreshToken, {
          type: 'bearer',
        })
        .expect(200);
    });

    it('should update password with oldPassword: /api/v1/auth/me (PATCH)', async () => {
      const newPassword = `new-${newUserPassword}`;

      await request(app)
        .patch('/api/v1/auth/me')
        .auth(newUserApiToken, {
          type: 'bearer',
        })
        .send({ password: newPassword, oldPassword: 'wrong-password' })
        .expect(401);

      await request(app)
        .patch('/api/v1/auth/me')
        .auth(newUserApiToken, {
          type: 'bearer',
        })
        .send({ password: newPassword, oldPassword: newUserPassword })
        .expect(200);

      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername, password: newPassword })
        .expect(200)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
        });

      await request(app)
        .patch('/api/v1/auth/me')
        .auth(newUserApiToken, {
          type: 'bearer',
        })
        .send({ password: newUserPassword, oldPassword: newPassword })
        .expect(200);
    });

    it('should update username directly: /api/v1/auth/me (PATCH)', async () => {
      const newUsername2 = `next.${newUsername}`;

      await request(app)
        .patch('/api/v1/auth/me')
        .auth(newUserApiToken, {
          type: 'bearer',
        })
        .send({ username: newUsername2 })
        .expect(200)
        .expect(({ body }) => {
          expect(body.username).toBe(newUsername2);
        });

      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername2, password: newUserPassword })
        .expect(200);
    });

    it('should delete profile: /api/v1/auth/me (DELETE)', async () => {
      const newUser = {
        username: `remove.${Date.now()}`,
        password: 'secret',
        nickname: 'Delete Me',
      };

      await request(app)
        .post('/api/v1/auth/email/register')
        .send(newUser)
        .expect(204);

      const token = await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUser.username, password: newUser.password })
        .then(({ body }) => body.token);

      await request(app)
        .delete('/api/v1/auth/me')
        .auth(token, {
          type: 'bearer',
        })
        .expect(204);

      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUser.username, password: newUser.password })
        .expect(404);
    });
  });
});
