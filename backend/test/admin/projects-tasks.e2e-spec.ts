import request from 'supertest';
import { APP_URL, ADMIN_PASSWORD, ADMIN_USERNAME } from '../utils/constants';

describe('Projects and Tasks Module', () => {
  const app = APP_URL;
  let adminToken: string;

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
      .expect(200)
      .then(({ body }) => {
        adminToken = body.token;
      });
  });

  it('should create project/template/task and execute one node', async () => {
    const businessLineName = `bl-project-${Date.now()}`;

    const createdBusinessLine = await request(app)
      .post('/api/v1/business-lines')
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        name: businessLineName,
        description: 'Business line for project/task e2e',
      })
      .expect(201)
      .then(({ body }) => body);

    const createdProject = await request(app)
      .post('/api/v1/projects')
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        businessLineId: createdBusinessLine.id,
        name: `project-${Date.now()}`,
        gitUrl: 'git@gitlab.yc345.tv:frontend/ainative.git',
        defaultBranch: 'main',
        configJson: {
          agent: 'codex',
          concurrency: 1,
        },
      })
      .expect(201)
      .then(({ body }) => body);

    await request(app)
      .get(`/api/v1/projects/${createdProject.id}`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(createdProject.id);
      });

    const createdTemplate = await request(app)
      .post('/api/v1/workflow-templates')
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        name: `template-${Date.now()}`,
        mode: 'workflow',
        nodes: [
          {
            nodeOrder: 1,
            name: 'analyze',
            type: 'agent',
            requiresApproval: false,
          },
          {
            nodeOrder: 2,
            name: 'review',
            type: 'manual',
            requiresApproval: true,
          },
        ],
      })
      .expect(201)
      .then(({ body }) => body);

    const versions = await request(app)
      .get(`/api/v1/workflow-templates/${createdTemplate.id}/versions`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .then(({ body }) => body as Array<{ version: number }>);

    expect(versions.length).toBeGreaterThan(0);

    const task = await request(app)
      .post('/api/v1/tasks')
      .auth(adminToken, {
        type: 'bearer',
      })
      .send({
        projectId: createdProject.id,
        workflowTemplateId: createdTemplate.id,
        workflowTemplateVersion: versions[0].version,
        title: 'e2e task',
        description: 'validate task flow',
        acceptanceCriteria: ['node1 done'],
      })
      .expect(201)
      .then(({ body }) => body);

    await request(app)
      .post(`/api/v1/tasks/${task.id}/execute`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.task.id).toBe(task.id);
        expect(Array.isArray(body.nodes)).toBeTruthy();
      });

    await new Promise((resolve) => {
      setTimeout(resolve, 800);
    });

    await request(app)
      .get(`/api/v1/tasks/${task.id}/detail`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.task.id).toBe(task.id);
        expect(Array.isArray(body.nodes)).toBeTruthy();
        expect(
          ['in_progress', 'in_review', 'done', 'todo'].includes(
            body.task.status,
          ),
        ).toBeTruthy();
      });

    await request(app)
      .get(`/api/v1/tasks/${task.id}/logs`)
      .auth(adminToken, {
        type: 'bearer',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBeTruthy();
        expect(body.length).toBeGreaterThan(0);
      });

    await request(app).get(`/api/v1/tasks/${task.id}/stream`).expect(401);
  }, 15000);
});
