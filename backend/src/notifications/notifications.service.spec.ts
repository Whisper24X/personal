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
  eventType: 'task.in_review',
  title: '任务待完成',
  content: '任务「测试任务」已进入待完成状态，请确认后完成任务。',
  payload: {
    status: 'in_review',
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

  it('should send task in_review webhook and keep browser event creation', async () => {
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
      status: 'in_review',
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
      status: 'in_review',
    });
    await flushPromises();

    await service.notifyTaskStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '测试任务',
      status: 'in_review',
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should use taskTitle in task in_review notification content', async () => {
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
      status: 'in_review',
    });

    expect(notificationEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '任务「我的重要任务」已进入待完成状态，请确认后完成任务。',
      }),
    );
  });

  it('should use pending completion wording for in_review task notifications', async () => {
    const notificationSettingRepository = {
      findByUserId: jest
        .fn()
        .mockResolvedValue(createSetting({ browserEnabled: true })),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn().mockResolvedValue(
        createEvent({
          eventType: 'task.in_review',
          title: '任务待完成',
          content: '任务「我的重要任务」已进入待完成状态，请确认后完成任务。',
          payload: {
            status: 'in_review',
          },
        }),
      ),
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
      status: 'in_review',
    });

    expect(notificationEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'task.in_review',
        title: '任务待完成',
        content: '任务「我的重要任务」已进入待完成状态，请确认后完成任务。',
        payload: {
          status: 'in_review',
        },
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
      status: 'in_review',
    });

    expect(notificationEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '任务「task-1」已进入待完成状态，请确认后完成任务。',
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

  it('should send feishu-formatted webhook for task in_review when URL contains feishu.cn', async () => {
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
      status: 'in_review',
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://open.feishu.cn/open-apis/bot/v2/hook/abc');
    const body = JSON.parse(options.body);
    expect(body.msg_type).toBe('post');
    const zhCn = body.content.post.zh_cn;
    expect(zhCn.title).toBe('任务待完成');
    expect(zhCn.content[0][0]).toEqual({
      tag: 'text',
      text: expect.stringContaining('测试任务'),
    });
    expect(zhCn.content[2]).toEqual([
      { tag: 'text', text: '事件类型: ' },
      { tag: 'text', text: 'task.in_review' },
    ]);
    expect(zhCn.content[3]).toEqual([
      { tag: 'text', text: '任务状态: ' },
      { tag: 'text', text: '待完成' },
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
      status: 'in_review',
    });

    expect(event).toBeNull();
    expect(notificationEventRepository.create).not.toHaveBeenCalled();
  });

  it('should send node in_review notification with node details', async () => {
    const notificationSettingRepository = {
      findByUserId: jest
        .fn()
        .mockResolvedValue(createSetting({ browserEnabled: true })),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn().mockResolvedValue(
        createEvent({
          eventType: 'task_node.in_review',
          title: '任务节点待审核',
          content:
            '任务「我的重要任务」的节点「生成页面」已进入待审核状态，请确认后继续。',
          payload: {
            status: 'in_review',
            nodeId: 'node-1',
            nodeName: '生成页面',
            nodeOrder: 2,
          },
        }),
      ),
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

    await service.notifyTaskNodeStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '我的重要任务',
      nodeId: 'node-1',
      nodeName: '生成页面',
      nodeOrder: 2,
      status: 'in_review',
    });

    expect(notificationEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'task_node.in_review',
        title: '任务节点待审核',
        content:
          '任务「我的重要任务」的节点「生成页面」已进入待审核状态，请确认后继续。',
        payload: {
          status: 'in_review',
          nodeId: 'node-1',
          nodeName: '生成页面',
          nodeOrder: 2,
        },
      }),
    );
  });

  it('should send node failed notification with recovery wording', async () => {
    const notificationSettingRepository = {
      findByUserId: jest
        .fn()
        .mockResolvedValue(createSetting({ browserEnabled: true })),
      create: jest.fn(),
      update: jest.fn(),
    };
    const notificationEventRepository = {
      create: jest.fn().mockResolvedValue(
        createEvent({
          eventType: 'task_node.failed',
          title: '任务节点失败',
          content:
            '任务「我的重要任务」的节点「生成页面」执行失败，请重置后继续。',
          payload: {
            status: 'failed',
            nodeId: 'node-1',
            nodeName: '生成页面',
            nodeOrder: 2,
          },
        }),
      ),
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

    await service.notifyTaskNodeStatusChanged({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: '我的重要任务',
      nodeId: 'node-1',
      nodeName: '生成页面',
      nodeOrder: 2,
      status: 'failed',
    });

    expect(notificationEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'task_node.failed',
        title: '任务节点失败',
        content:
          '任务「我的重要任务」的节点「生成页面」执行失败，请重置后继续。',
        payload: {
          status: 'failed',
          nodeId: 'node-1',
          nodeName: '生成页面',
          nodeOrder: 2,
        },
      }),
    );
  });

  it('should not create task notification when status is done', async () => {
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
    expect(notificationSettingRepository.findByUserId).not.toHaveBeenCalled();
  });
});
