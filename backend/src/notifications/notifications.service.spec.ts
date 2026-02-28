import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const createSetting = (overrides?: Partial<any>) => ({
  id: 'setting-1',
  userId: 'user-1',
  emailEnabled: false,
  emailAddress: null,
  webhookEnabled: false,
  webhookUrl: null,
  browserEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...(overrides ?? {}),
});

const createEvent = (overrides?: Partial<any>) => ({
  id: 'event-1',
  userId: 'user-1',
  taskId: 'task-1',
  eventType: 'task.done',
  title: '任务执行完成',
  content: '任务 task-1 已执行完成。',
  payload: {
    status: 'done',
  },
  readAt: null,
  createdAt: new Date(),
  ...(overrides ?? {}),
});

const flushPromises = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
};

describe('NotificationsService', () => {
  const originalFetch = global.fetch;
  const createNotificationEmailService = (overrides?: Partial<any>) => ({
    sendTaskStatusEmail: jest.fn().mockResolvedValue(undefined),
    ...(overrides ?? {}),
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('should reject enabling webhook without webhook url', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(createSetting()),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
    };
    const notificationEmailService = createNotificationEmailService();

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      notificationEmailService as never,
    );

    await expect(
      service.updateMySetting('user-1', {
        webhookEnabled: true,
        webhookUrl: '',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject enabling email without email address', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(createSetting()),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
    };
    const notificationEmailService = createNotificationEmailService();

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      notificationEmailService as never,
    );

    await expect(
      service.updateMySetting('user-1', {
        emailEnabled: true,
        emailAddress: null,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should send webhook and keep browser event creation', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(
        createSetting({
          webhookEnabled: true,
          webhookUrl: 'https://example.com/hook',
          browserEnabled: true,
        }),
      ),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn().mockResolvedValue(createEvent()),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
    };
    const notificationEmailService = createNotificationEmailService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    global.fetch = fetchMock;

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      notificationEmailService as never,
    );

    const event = await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      status: 'done',
    });
    await flushPromises();

    expect(event).toEqual(expect.objectContaining({ id: 'event-1' }));
    expect(notificationEventRepository.create).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(notificationEmailService.sendTaskStatusEmail).not.toHaveBeenCalled();
  });

  it('should dedupe webhook by user/task/event type within 60 seconds', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(
        createSetting({
          webhookEnabled: true,
          webhookUrl: 'https://example.com/hook',
          browserEnabled: false,
        }),
      ),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
    };
    const notificationEmailService = createNotificationEmailService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    global.fetch = fetchMock;

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      notificationEmailService as never,
    );

    await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      status: 'done',
    });
    await flushPromises();

    await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      status: 'done',
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should send email notification when emailAddress is configured', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(
        createSetting({
          emailEnabled: true,
          emailAddress: 'dev@example.com',
          webhookEnabled: false,
          browserEnabled: false,
        }),
      ),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
    };
    const notificationEmailService = createNotificationEmailService();

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      notificationEmailService as never,
    );

    const event = await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      status: 'done',
    });
    await flushPromises();

    expect(event).toBeNull();
    expect(notificationEmailService.sendTaskStatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dev@example.com',
        eventType: 'task.done',
      }),
    );
    expect(notificationEventRepository.create).not.toHaveBeenCalled();
  });

  it('should keep browser event when email delivery fails', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(
        createSetting({
          emailEnabled: true,
          emailAddress: 'dev@example.com',
          webhookEnabled: false,
          browserEnabled: true,
        }),
      ),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn().mockResolvedValue(createEvent()),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
    };
    const notificationEmailService = createNotificationEmailService({
      sendTaskStatusEmail: jest.fn().mockRejectedValue(new Error('smtp down')),
    });

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      notificationEmailService as never,
    );

    const event = await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      status: 'in_review',
    });
    await flushPromises();

    expect(event).toEqual(expect.objectContaining({ id: 'event-1' }));
    expect(notificationEventRepository.create).toHaveBeenCalledTimes(1);
  });

  it('should skip browser event when browser channel is disabled', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(
        createSetting({
          emailEnabled: false,
          webhookEnabled: false,
          browserEnabled: false,
        }),
      ),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
    };
    const notificationEmailService = createNotificationEmailService();

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      notificationEmailService as never,
    );

    const event = await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      status: 'done',
    });

    expect(event).toBeNull();
    expect(notificationEventRepository.create).not.toHaveBeenCalled();
  });
});
