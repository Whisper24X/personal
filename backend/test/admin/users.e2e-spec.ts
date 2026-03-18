import { APP_URL } from '../utils/constants';
import { createAdminSession } from '../utils/auth-fixtures';
import request from 'supertest';

describe('Users Module', () => {
  const app = APP_URL;
  let apiToken;

  beforeAll(async () => {
    ({ token: apiToken } = await createAdminSession(app));
  });

  describe('Update', () => {
    let newUser;
    const newUsername = `user-first.${Date.now()}`;
    const newUserChangedUsername = `user-first-changed.${Date.now()}`;
    const newUserPassword = `secret`;
    const newUserChangedPassword = `new-secret`;

    beforeAll(async () => {
      await request(app)
        .post('/api/v1/auth/email/register')
        .send({
          username: newUsername,
          password: newUserPassword,
          nickname: `First${Date.now()}`,
        });

      await request(app)
        .post('/api/v1/auth/email/login')
        .send({ username: newUsername, password: newUserPassword })
        .then(({ body }) => {
          newUser = body.user;
        });
    });

    describe('User with "Admin" role', () => {
      it('should change password for existing user: /api/v1/users/:id (PATCH)', () => {
        return request(app)
          .patch(`/api/v1/users/${newUser.id}`)
          .auth(apiToken, {
            type: 'bearer',
          })
          .send({
            username: newUserChangedUsername,
            password: newUserChangedPassword,
          })
          .expect(200);
      });

      describe('Guest', () => {
        it('should login with changed password: /api/v1/auth/email/login (POST)', () => {
          return request(app)
            .post('/api/v1/auth/email/login')
            .send({
              username: newUserChangedUsername,
              password: newUserChangedPassword,
            })
            .expect(200)
            .expect(({ body }) => {
              expect(body.token).toBeDefined();
            });
        });
      });
    });
  });

  describe('Create', () => {
    const newUserByAdminUsername = `user-created-by-admin.${Date.now()}`;
    const newUserByAdminPassword = `secret`;

    describe('User with "Admin" role', () => {
      it('should fail to create new user with invalid payload: /api/v1/users (POST)', () => {
        return request(app)
          .post(`/api/v1/users`)
          .auth(apiToken, {
            type: 'bearer',
          })
          .send({})
          .expect(422);
      });

      it('should successfully create new user: /api/v1/users (POST)', () => {
        return request(app)
          .post(`/api/v1/users`)
          .auth(apiToken, {
            type: 'bearer',
          })
          .send({
            username: newUserByAdminUsername,
            password: newUserByAdminPassword,
            nickname: `UserByAdmin${Date.now()}`,
          })
          .expect(201);
      });

      describe('Guest', () => {
        it('should successfully login via created by admin user: /api/v1/auth/email/login (GET)', () => {
          return request(app)
            .post('/api/v1/auth/email/login')
            .send({
              username: newUserByAdminUsername,
              password: newUserByAdminPassword,
            })
            .expect(200)
            .expect(({ body }) => {
              expect(body.token).toBeDefined();
            });
        });
      });
    });
  });

  describe('Get many', () => {
    describe('User with "Admin" role', () => {
      it('should get list of users: /api/v1/users (GET)', () => {
        return request(app)
          .get(`/api/v1/users`)
          .auth(apiToken, {
            type: 'bearer',
          })
          .expect(200)
          .send()
          .expect(({ body }) => {
            expect(body.data[0].username).toBeDefined();
            expect(body.data[0].password).not.toBeDefined();
          });
      });
    });
  });
});
