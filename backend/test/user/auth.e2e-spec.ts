import request from 'supertest';
import { APP_URL, TESTER_EMAIL, TESTER_PASSWORD } from '../utils/constants';

describe('Auth Module', () => {
  const app = APP_URL;
  const newUserFirstName = `Tester${Date.now()}`;
  const newUserLastName = 'E2E';
  const newUserEmail = `user.${Date.now()}@example.com`;
  const newUserPassword = 'secret';

  describe('Registration', () => {
    it('should fail with existing email: /api/v1/auth/email/register (POST)', () => {
      return request(app)
        .post('/api/v1/auth/email/register')
        .send({
          email: TESTER_EMAIL,
          password: TESTER_PASSWORD,
          firstName: 'Tester',
          lastName: 'E2E',
        })
        .expect(422)
        .expect(({ body }) => {
          expect(body.errors.email).toBeDefined();
        });
    });

    it('should succeed: /api/v1/auth/email/register (POST)', () => {
      return request(app)
        .post('/api/v1/auth/email/register')
        .send({
          email: newUserEmail,
          password: newUserPassword,
          firstName: newUserFirstName,
          lastName: newUserLastName,
        })
        .expect(204);
    });
  });

  describe('Login', () => {
    it('should succeed: /api/v1/auth/email/login (POST)', () => {
      return request(app)
        .post('/api/v1/auth/email/login')
        .send({ email: newUserEmail, password: newUserPassword })
        .expect(200)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
          expect(body.refreshToken).toBeDefined();
          expect(body.tokenExpires).toBeDefined();
          expect(body.user.email).toBeDefined();
          expect(body.user.password).not.toBeDefined();
        });
    });
  });

  describe('Logged in user', () => {
    let newUserApiToken: string;

    beforeAll(async () => {
      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ email: newUserEmail, password: newUserPassword })
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
          expect(body.email).toBeDefined();
          expect(body.password).not.toBeDefined();
        });
    });

    it('should rotate refresh token: /api/v1/auth/refresh (POST)', async () => {
      let newUserRefreshToken = await request(app)
        .post('/api/v1/auth/email/login')
        .send({ email: newUserEmail, password: newUserPassword })
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
        .send({ email: newUserEmail, password: newUserPassword })
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
        .send({ email: newUserEmail, password: newUserPassword })
        .then(({ body }) => body.refreshToken);

      const token = await request(app)
        .post('/api/v1/auth/email/login')
        .send({ email: newUserEmail, password: newUserPassword })
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
        .expect(422);

      await request(app)
        .patch('/api/v1/auth/me')
        .auth(newUserApiToken, {
          type: 'bearer',
        })
        .send({ password: newPassword, oldPassword: newUserPassword })
        .expect(200);

      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ email: newUserEmail, password: newPassword })
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

    it('should update email directly: /api/v1/auth/me (PATCH)', async () => {
      const newUserEmail2 = `next.${newUserEmail}`;

      await request(app)
        .patch('/api/v1/auth/me')
        .auth(newUserApiToken, {
          type: 'bearer',
        })
        .send({ email: newUserEmail2 })
        .expect(200)
        .expect(({ body }) => {
          expect(body.email).toBe(newUserEmail2);
        });

      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ email: newUserEmail2, password: newUserPassword })
        .expect(200);
    });

    it('should delete profile: /api/v1/auth/me (DELETE)', async () => {
      const newUser = {
        email: `remove.${Date.now()}@example.com`,
        password: 'secret',
        firstName: 'Delete',
        lastName: 'Me',
      };

      await request(app)
        .post('/api/v1/auth/email/register')
        .send(newUser)
        .expect(204);

      const token = await request(app)
        .post('/api/v1/auth/email/login')
        .send({ email: newUser.email, password: newUser.password })
        .then(({ body }) => body.token);

      await request(app)
        .delete('/api/v1/auth/me')
        .auth(token, {
          type: 'bearer',
        })
        .expect(204);

      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ email: newUser.email, password: newUser.password })
        .expect(422);
    });
  });
});
