import {
  createHttpAccessLogMiddleware,
  formatHttpAccessLogMessage,
  resolveHttpAccessLogLevel,
  shouldIgnoreHttpAccessLog,
} from './http-access-log.middleware';

describe('formatHttpAccessLogMessage', () => {
  it('should format completed requests with status code and duration', () => {
    expect(
      formatHttpAccessLogMessage({
        method: 'get',
        url: '/api/v1/tasks/1',
        statusCode: 200,
        durationMs: 44.37,
      }),
    ).toBe('GET /api/v1/tasks/1 200 44.4ms');
  });

  it('should format aborted requests without a status code', () => {
    expect(
      formatHttpAccessLogMessage({
        method: 'post',
        url: '/api/v1/tasks/1/cancel',
        durationMs: 3005.12,
        aborted: true,
      }),
    ).toBe('POST /api/v1/tasks/1/cancel aborted 3005.1ms');
  });
});

describe('resolveHttpAccessLogLevel', () => {
  it('should warn on slow requests', () => {
    expect(
      resolveHttpAccessLogLevel({
        durationMs: 1200,
        statusCode: 200,
      }),
    ).toBe('warn');
  });

  it('should warn on server errors', () => {
    expect(
      resolveHttpAccessLogLevel({
        durationMs: 20,
        statusCode: 500,
      }),
    ).toBe('warn');
  });

  it('should log normal successful requests', () => {
    expect(
      resolveHttpAccessLogLevel({
        durationMs: 20,
        statusCode: 200,
      }),
    ).toBe('log');
  });
});

describe('shouldIgnoreHttpAccessLog', () => {
  it('should ignore the root health-check endpoint', () => {
    expect(shouldIgnoreHttpAccessLog('/')).toBe(true);
    expect(shouldIgnoreHttpAccessLog('/?probe=1')).toBe(true);
  });

  it('should keep API requests enabled', () => {
    expect(shouldIgnoreHttpAccessLog('/api/v1/projects')).toBe(false);
  });
});

describe('createHttpAccessLogMiddleware', () => {
  it('should skip ignored paths without logging', () => {
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    const middleware = createHttpAccessLogMiddleware({
      enabled: true,
      logger,
    });
    const req = {
      method: 'GET',
      originalUrl: '/',
      url: '/',
    } as any;
    const res = {
      once: jest.fn(),
    } as any;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.once).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
