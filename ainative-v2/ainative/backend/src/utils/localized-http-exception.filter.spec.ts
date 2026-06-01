import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'fs';
import {
  HeaderResolver,
  I18nContext,
  I18nModule,
  I18nService,
} from 'nestjs-i18n';
import path from 'path';
import { LocalizedHttpExceptionFilter } from './localized-http-exception.filter';
import validationOptions from './validation-options';

type CapturedResponse = {
  status?: number;
  body?: unknown;
};

const getTranslationValue = (
  translations: Record<string, unknown>,
  key: string,
): unknown => {
  return key
    .split('.')
    .slice(1)
    .reduce<unknown>((currentValue, keyPart) => {
      if (
        typeof currentValue !== 'object' ||
        currentValue === null ||
        !(keyPart in currentValue)
      ) {
        return undefined;
      }

      return (currentValue as Record<string, unknown>)[keyPart];
    }, translations);
};

const collectErrorKeysFromSource = (filePath: string): Set<string> => {
  const source = readFileSync(filePath, 'utf8');
  return new Set(
    Array.from(source.matchAll(/['`](errors\.[A-Za-z0-9_.]+)['`]/g)).map(
      (match) => match[1],
    ),
  );
};

describe('LocalizedHttpExceptionFilter', () => {
  let moduleRef: TestingModule;
  let i18n: I18nService;
  let filter: LocalizedHttpExceptionFilter;

  const createHost = (lang = 'zh') => {
    const captured: CapturedResponse = {};
    const response = {
      status(code: number) {
        captured.status = code;
        return this;
      },
      json(body: unknown) {
        captured.body = body;
        return this;
      },
    };

    return {
      captured,
      host: {
        getType: () => 'http',
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => ({ i18nContext: new I18nContext(lang, i18n) }),
        }),
      } as ArgumentsHost,
    };
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        I18nModule.forRoot({
          fallbackLanguage: 'zh',
          loaderOptions: { path: path.join(__dirname, '..', 'i18n') },
          resolvers: [new HeaderResolver(['x-custom-lang'])],
        }),
      ],
    }).compile();
    await moduleRef.init();
    i18n = moduleRef.get(I18nService);
    filter = new LocalizedHttpExceptionFilter(i18n);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should localize legacy English HTTP exception messages', () => {
    const { captured, host } = createHost();

    filter.catch(new NotFoundException('Project not found'), host);

    expect(captured).toEqual({
      status: 404,
      body: {
        statusCode: 404,
        message: '项目不存在',
        error: '未找到',
      },
    });
  });

  it('should localize validation exception messages with real i18n interpolation', async () => {
    const { captured, host } = createHost();
    const exceptionFactory = validationOptions.exceptionFactory;

    expect(exceptionFactory).toBeDefined();
    await I18nContext.createAsync(new I18nContext('zh', i18n), () => {
      const exception = exceptionFactory!([
        {
          property: 'name',
          constraints: { isString: 'name must be a string' },
          children: [],
        },
      ]);

      filter.catch(exception, host);
      return Promise.resolve();
    });

    expect(captured).toEqual({
      status: 422,
      body: {
        status: 422,
        statusCode: 422,
        message: '参数校验失败',
        errors: { name: 'name 必须是字符串' },
      },
    });
  });

  it('should return localized generic responses for unknown HTTP errors', () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { captured, host } = createHost();

    filter.catch(new Error('database failure'), host);

    expect(captured).toEqual({
      status: 500,
      body: {
        statusCode: 500,
        message: '服务器内部错误',
      },
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      'Unhandled HTTP exception',
      expect.stringContaining('database failure'),
    );
  });

  it('should keep every referenced error key available in zh and en resources', () => {
    const sourceFiles = [
      path.join(__dirname, 'localized-http-exception.filter.ts'),
      path.join(__dirname, 'validation-options.ts'),
    ];
    const keys = sourceFiles.reduce((allKeys, sourceFile) => {
      collectErrorKeysFromSource(sourceFile).forEach((key) => allKeys.add(key));
      return allKeys;
    }, new Set<string>());

    for (const lang of ['zh', 'en']) {
      const translations = JSON.parse(
        readFileSync(
          path.join(__dirname, '..', 'i18n', lang, 'errors.json'),
          'utf8',
        ),
      ) as Record<string, unknown>;
      const missingKeys = Array.from(keys).filter(
        (key) => getTranslationValue(translations, key) === undefined,
      );

      expect(missingKeys).toEqual([]);
    }
  });
});
