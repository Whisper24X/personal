import request from 'supertest';
import {
  APP_URL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  TESTER_PASSWORD,
  TESTER_USERNAME,
} from '../utils/constants';

describe('Business Lines Module', () => {
  const app = APP_URL;
  let adminToken: string;
  let testerToken: string;

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
      .expect(200)
      .then(({ body }) => {
        adminToken = body.token;
      });

    await request(app)
      .post('/api/v1/auth/login')
      .send({ username: TESTER_USERNAME, password: TESTER_PASSWORD })
      .expect(200)
      .then(({ body }) => {
        testerToken = body.token;
      });
  });

  it('should create/list/get/update/delete business line and manage members', async () => {
    const businessLineName = `bl-${Date.now()}`;

    const createdBusinessLine = await request(app)
      .post('/api/v1/business-lines')
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        name: businessLineName,
        description: 'Business line for e2e',
      })
      .expect(201)
      .then(({ body }) => body);

    const businessLineId = createdBusinessLine.id;

    await request(app)
      .get('/api/v1/business-lines')
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body.data)).toBeTruthy();
      });

    await request(app)
      .get(`/api/v1/business-lines/${businessLineId}`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(businessLineId);
        expect(body.name).toBe(businessLineName);
      });

    await request(app)
      .patch(`/api/v1/business-lines/${businessLineId}`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        description: 'Business line updated',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.description).toBe('Business line updated');
      });

    const adminUser = await request(app)
      .get('/api/v1/auth/me')
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .then(({ body }) => body);

    await request(app)
      .get(`/api/v1/business-lines/${businessLineId}/members`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBeTruthy();
      });

    const firstInviteResponse = await request(app)
      .post(`/api/v1/business-lines/${businessLineId}/invitations`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        role: 'member',
      })
      .expect(201)
      .then(({ body }) => body);

    expect(firstInviteResponse.token).toBeDefined();

    const secondInviteResponse = await request(app)
      .post(`/api/v1/business-lines/${businessLineId}/invitations`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        role: 'member',
      })
      .expect(201)
      .then(({ body }) => body);

    expect(secondInviteResponse.token).toBeDefined();
    expect(secondInviteResponse.token).not.toBe(firstInviteResponse.token);

    await request(app)
      .get(`/api/v1/business-lines/${businessLineId}/invitations/latest`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.token).toBe(secondInviteResponse.token);
      });

    await request(app)
      .post('/api/v1/business-lines/invitations/accept')
      .auth(testerToken, {
        type: 'bearer',
      })
      .send({
        token: firstInviteResponse.token,
      })
      .expect(403);

    await request(app)
      .post('/api/v1/business-lines/invitations/accept')
      .auth(testerToken, {
        type: 'bearer',
      })
      .send({
        token: secondInviteResponse.token,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.member?.role).toBe('member');
      });

    await request(app)
      .post('/api/v1/business-lines/invitations/accept')
      .auth(testerToken, {
        type: 'bearer',
      })
      .send({
        token: secondInviteResponse.token,
      })
      .expect(409);

    await request(app)
      .post(`/api/v1/business-lines/${businessLineId}/members`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        userId: adminUser.id,
        role: 'admin',
      })
      .expect(409);

    await request(app)
      .patch(`/api/v1/business-lines/${businessLineId}/members/${adminUser.id}`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        role: 'owner',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.role).toBe('owner');
      });

    await request(app)
      .delete(
        `/api/v1/business-lines/${businessLineId}/members/${adminUser.id}`,
      )
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(409);

    await request(app)
      .delete(`/api/v1/business-lines/${businessLineId}`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(204);

    await request(app)
      .get(`/api/v1/business-lines/${businessLineId}`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({});
      });
  });
});
