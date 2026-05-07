import {
  HttpStatus,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipeOptions,
} from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';

const DEFAULT_LANGUAGE = 'zh';

const CONSTRAINT_MESSAGE_KEYS: Record<string, string> = {
  arrayMinSize: 'errors.validation.arrayMinSize',
  arrayNotEmpty: 'errors.validation.arrayNotEmpty',
  isArray: 'errors.validation.isArray',
  isBoolean: 'errors.validation.isBoolean',
  isBooleanString: 'errors.validation.isBooleanString',
  isEmail: 'errors.validation.isEmail',
  isEnum: 'errors.validation.isEnum',
  isIn: 'errors.validation.isIn',
  isInt: 'errors.validation.isInt',
  isNotEmpty: 'errors.validation.isNotEmpty',
  isNumber: 'errors.validation.isNumber',
  isObject: 'errors.validation.isObject',
  isString: 'errors.validation.isString',
  isUrl: 'errors.validation.isUrl',
  isUuid: 'errors.validation.isUuid',
  isUUID: 'errors.validation.isUuid',
  matches: 'errors.validation.matches',
  max: 'errors.validation.max',
  maxLength: 'errors.validation.maxLength',
  min: 'errors.validation.min',
  minLength: 'errors.validation.minLength',
  validateNested: 'errors.validation.validateNested',
  whitelistValidation: 'errors.validation.whitelistValidation',
};

const generateConstraintMessages = (error: ValidationError): string => {
  const i18n = I18nContext.current();
  const lang = i18n?.lang ?? DEFAULT_LANGUAGE;

  return Object.entries(error.constraints ?? {})
    .map(([constraintName, message]) => {
      const key =
        CONSTRAINT_MESSAGE_KEYS[constraintName] ?? 'errors.validation.fallback';

      return (
        i18n?.translate(key, {
          lang,
          args: { property: error.property },
          defaultValue: message,
        }) ?? message
      );
    })
    .join(', ');
};

function generateErrors(errors: ValidationError[]) {
  return errors.reduce(
    (accumulator, currentValue) => ({
      ...accumulator,
      [currentValue.property]:
        (currentValue.children?.length ?? 0) > 0
          ? generateErrors(currentValue.children ?? [])
          : generateConstraintMessages(currentValue),
    }),
    {},
  );
}

const validationOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory: (errors: ValidationError[]) => {
    const i18n = I18nContext.current();
    const lang = i18n?.lang ?? DEFAULT_LANGUAGE;

    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message:
        i18n?.translate('errors.validation.failed', {
          lang,
          defaultValue: '参数校验失败',
        }) ?? '参数校验失败',
      errors: generateErrors(errors),
    });
  },
};

export default validationOptions;
