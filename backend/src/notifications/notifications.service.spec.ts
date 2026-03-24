import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const mockConfigService = { get: () => undefined } as never;

const createSetting = (overrides?: Partial<any>) => ({
  id: 'setting-1',
  userId: 'user-1',
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
  content: '任务「测试任务」已执行完成。',
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

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    await expect(
      service.updateMySetting('user-1', {
        webhookEnabled: true,
        webhookUrl: '',
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
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    global.fetch = fetchMock;

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    const event = await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '测试任务',
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
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    global.fetch = fetchMock;

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '测试任务',
      status: 'done',
    });
    await flushPromises();

    await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '测试任务',
      status: 'done',
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should use taskTitle in notification content', async () => {
    const notificationSettingRepository = {
      findByUserId: jest
        .fn()
        .mockResolvedValue(createSetting({ browserEnabled: true })),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn().mockResolvedValue(createEvent()),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
      markAllReadByUserId: jest.fn(),
      deleteReadByUserId: jest.fn(),
      countUnreadByUserId: jest.fn(),
    };

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '我的重要任务',
      status: 'done',
    });

    expect(notificationEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '任务「我的重要任务」已执行完成。',
      }),
    );
  });

  it('should fall back to taskId when taskTitle is not provided', async () => {
    const notificationSettingRepository = {
      findByUserId: jest
        .fn()
        .mockResolvedValue(createSetting({ browserEnabled: true })),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn().mockResolvedValue(createEvent()),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
      markAllReadByUserId: jest.fn(),
      deleteReadByUserId: jest.fn(),
      countUnreadByUserId: jest.fn(),
    };

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      status: 'done',
    });

    expect(notificationEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '任务「task-1」已执行完成。',
      }),
    );
  });

  it('should mark all unread events as read', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
      markAllReadByUserId: jest.fn().mockResolvedValue(3),
      deleteReadByUserId: jest.fn(),
      countUnreadByUserId: jest.fn(),
    };

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    const result = await service.markAllEventsRead('user-1');

    expect(result).toEqual({ affected: 3 });
    expect(
      notificationEventRepository.markAllReadByUserId,
    ).toHaveBeenCalledWith('user-1', expect.any(Date));
  });

  it('should delete all read events', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
      markAllReadByUserId: jest.fn(),
      deleteReadByUserId: jest.fn().mockResolvedValue(5),
      countUnreadByUserId: jest.fn(),
    };

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    const result = await service.deleteReadEvents('user-1');

    expect(result).toEqual({ affected: 5 });
    expect(notificationEventRepository.deleteReadByUserId).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('should count unread events', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
      markAllReadByUserId: jest.fn(),
      deleteReadByUserId: jest.fn(),
      countUnreadByUserId: jest.fn().mockResolvedValue(7),
    };

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    const result = await service.countUnreadEvents('user-1');

    expect(result).toEqual({ count: 7 });
    expect(
      notificationEventRepository.countUnreadByUserId,
    ).toHaveBeenCalledWith('user-1');
  });

  it('should send feishu-formatted webhook when URL contains feishu.cn', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(
        createSetting({
          webhookEnabled: true,
          webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/abc',
          webhookSecret: 'test-secret',
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
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    global.fetch = fetchMock;

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      { get: () => 'http://localhost:8000' } as never,
    );

    await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '测试任务',
      status: 'done',
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://open.feishu.cn/open-apis/bot/v2/hook/abc',
    );
    const body = JSON.parse(options.body);
    expect(body.msg_type).toBe('post');
    const zhCn = body.content.post.zh_cn;
    expect(zhCn.title).toBe('任务执行完成');
    expect(zhCn.content[0][0]).toEqual({
      tag: 'text',
      text: expect.stringContaining('测试任务'),
    });
    expect(zhCn.content[2]).toEqual([
      { tag: 'text', text: '事件类型: ' },
      { tag: 'text', text: 'task.done' },
    ]);
    expect(zhCn.content[3]).toEqual([
      { tag: 'text', text: '任务状态: ' },
      { tag: 'text', text: '已完成' },
    ]);
    const lastLine = zhCn.content[zhCn.content.length - 1];
    expect(lastLine[0]).toEqual({
      tag: 'a',
      text: '>> 查看任务详情',
      href: 'http://localhost:8000/task-detail/task-1',
    });
    expect(body.timestamp).toBeDefined();
    expect(body.sign).toBeDefined();
  });

  it('should skip browser event when browser channel is disabled', async () => {
    const notificationSettingRepository = {
      findByUserId: jest.fn().mockResolvedValue(
        createSetting({
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

    const service = new NotificationsService(
      notificationSettingRepository as never,
      notificationEventRepository as never,
      { emit: jest.fn() } as never,
      mockConfigService,
    );

    const event = await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '测试任务',
      status: 'done',
    });

    expect(event).toBeNull();
    expect(notificationEventRepository.create).not.toHaveBeenCalled();
  });
});
