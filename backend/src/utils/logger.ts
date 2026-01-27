/**
 * Logger utility using Winston with daily rotate file
 * Supports logging by date and by project
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'debug';

// 确定日志目录路径（相对于项目根目录）
const logsDir = path.join(process.cwd(), 'logs');

// 日志格式配置
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 配置全局日志文件（按日期拆分）
const errorLogTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d', // 保留14天的日志
  format: logFormat,
});

const combinedLogTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d', // 保留14天的日志
  format: logFormat,
});

// 全局 logger（用于没有项目ID的日志）
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'mind2build' },
  transports: [
    errorLogTransport,
    combinedLogTransport,
  ],
});

// If not in production, log to console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let msg = `${timestamp} [${service}] ${level}: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      ),
    })
  );
}

// 项目 logger 缓存
const projectLoggers = new Map<string, winston.Logger>();

/**
 * 创建项目特定的 logger
 * 日志文件格式：logs/projects/{projectId}/error-YYYY-MM-DD.log 和 combined-YYYY-MM-DD.log
 * @param projectId 项目ID
 * @returns 项目特定的 logger 实例
 */
export function getProjectLogger(projectId: string): winston.Logger {
  // 如果已存在，直接返回缓存的 logger
  if (projectLoggers.has(projectId)) {
    return projectLoggers.get(projectId)!;
  }

  // 创建项目特定的日志目录
  const projectLogsDir = path.join(logsDir, 'projects', projectId);

  // 创建项目特定的错误日志 transport
  const projectErrorTransport = new DailyRotateFile({
    filename: path.join(projectLogsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d', // 项目日志保留30天
    format: logFormat,
  });

  // 创建项目特定的综合日志 transport
  const projectCombinedTransport = new DailyRotateFile({
    filename: path.join(projectLogsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d', // 项目日志保留30天
    format: logFormat,
  });

  // 创建项目特定的 logger
  const projectLogger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: { 
      service: 'mind2build',
      projectId: projectId,
    },
    transports: [
      projectErrorTransport,
      projectCombinedTransport,
      // 同时输出到全局日志（可选，如果需要集中查看所有项目日志）
      errorLogTransport,
      combinedLogTransport,
    ],
  });

  // 如果不是生产环境，也输出到控制台
  if (process.env.NODE_ENV !== 'production') {
    projectLogger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, projectId, ...meta }) => {
            let msg = `${timestamp} [${service}]${projectId ? ` [Project:${projectId}]` : ''} ${level}: ${message}`;
            if (Object.keys(meta).length > 0) {
              msg += ` ${JSON.stringify(meta)}`;
            }
            return msg;
          })
        ),
      })
    );
  }

  // 缓存 logger
  projectLoggers.set(projectId, projectLogger);

  return projectLogger;
}

export default logger;

