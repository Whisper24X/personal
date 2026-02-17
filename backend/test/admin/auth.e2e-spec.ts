import request from 'supertest';
import { ADMIN_PASSWORD, ADMIN_USERNAME, APP_URL } from '../utils/constants';

describe('Auth', () => {
  const app = APP_URL;

  describe('Admin', () => {
    it('should successfully login via /api/v1/auth/email/login (POST)', () => {
      return request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
        .expect(200)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
          expect(body.user.username).toBeDefined();
        });
    });

    it('should successfully login via /api/v1/auth/login (POST)', () => {
      return request(app)
        .post('/api/v1/auth/login')
        .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
        .expect(200)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
          expect(body.user.username).toBeDefined();
        });
    });
  });
});
