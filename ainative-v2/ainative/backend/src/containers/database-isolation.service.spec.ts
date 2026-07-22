import { DatabaseIsolationService } from './database-isolation.service';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn(),
  rm: jest.fn(),
}));

jest.mock('pg', () => ({
  Client: jest.fn(),
}));

const { execFile: mockExecFile } = jest.requireMock('child_process') as {
  execFile: jest.Mock;
};
const { mkdtemp: mockMkdtemp, rm: mockRm } = jest.requireMock(
  'fs/promises',
) as {
  mkdtemp: jest.Mock;
  rm: jest.Mock;
};
const { Client: mockClient } = jest.requireMock('pg') as {
  Client: jest.Mock;
};

type MockPgClient = {
  connect: jest.Mock<Promise<void>, []>;
  query: jest.Mock<Promise<unknown>, [string, unknown[]?]>;
  end: jest.Mock<Promise<void>, []>;
};

const createMockPgClient = (): MockPgClient => ({
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  end: jest.fn().mockResolvedValue(undefined),
});

describe('DatabaseIsolationService', () => {
  const service = new DatabaseIsolationService();
  const config = {
    enabled: true,
    envVar: 'APP_DB_NAME',
    postgres: {
      host: '127.0.0.1',
      port: 5432,
      adminUser: 'postgres',
      sourceDatabase: 'app',
    },
    dataImport: {
      tables: ['users'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMkdtemp.mockResolvedValue('/tmp/task-db');
    mockRm.mockResolvedValue(undefined);
  });

  it('should acquire advisory lock and skip initialization when database already exists', async () => {
    const client = createMockPgClient();
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});
    mockClient.mockImplementationOnce(() => client);

    await service.ensureTaskDatabase(config, 'secret', 'task_demo_app');

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_lock(hashtext($1), hashtext($2))',
      ['ainative_task_database', 'task_demo_app'],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT 1 FROM pg_database WHERE datname = $1',
      ['task_demo_app'],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      'SELECT pg_advisory_unlock(hashtext($1), hashtext($2))',
      ['ainative_task_database', 'task_demo_app'],
    );
    expect(mockExecFile).not.toHaveBeenCalled();
    expect(mockMkdtemp).not.toHaveBeenCalled();
  });

  it('should terminate connections and drop partial database when import fails', async () => {
    const client = createMockPgClient();
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    mockClient.mockImplementationOnce(() => client);

    mockExecFile
      .mockImplementationOnce(
        (
          _command: string,
          _args: string[],
          _options: unknown,
          callback: (
            error: Error | null,
            stdout: string,
            stderr: string,
          ) => void,
        ) => callback(null, '', ''),
      )
      .mockImplementationOnce(
        (
          _command: string,
          _args: string[],
          _options: unknown,
          callback: (
            error: Error | null,
            stdout: string,
            stderr: string,
          ) => void,
        ) => callback(new Error('apply failed'), '', 'schema apply failed'),
      );

    await expect(
      service.ensureTaskDatabase(config, 'secret', 'task_demo_app'),
    ).rejects.toThrow('psql failed: schema apply failed');

    expect(client.query).toHaveBeenCalledWith(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      ['task_demo_app'],
    );
    expect(client.query).toHaveBeenCalledWith(
      'ALTER DATABASE "task_demo_app" ALLOW_CONNECTIONS false',
    );
    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      ['task_demo_app'],
    );
    expect(client.query).toHaveBeenCalledWith(
      'DROP DATABASE IF EXISTS "task_demo_app"',
    );
    expect(mockRm).toHaveBeenCalledWith('/tmp/task-db', {
      recursive: true,
      force: true,
    });
  });
});
