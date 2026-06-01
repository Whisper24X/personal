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

/**
 * 过滤长日志内容，特别是 Stagehand 的详细元素日志
 * @param message 日志消息
 * @param meta 日志元数据
 * @returns 过滤后的消息和元数据
 */
function filterLongLogs(message: string, meta: any): { message: string; meta: any } {
  // 如果消息包含 accessibility tree 且过长，截断
  if (message.includes('Accessibility Tree') || (message.length > 1000 && (message.includes('accessibility') || message.includes('Accessibility')))) {
    // 只保留关键信息
    return {
      message: message.substring(0, 200) + '... [内容过长已截断 - 包含 Accessibility Tree]',
      meta: { ...meta, truncated: true },
    };
  }

  // 如果消息本身过长（可能是包含完整元素树），截断
  if (message.length > 2000) {
    // 检查是否包含 JSON 格式的 accessibility tree
    if (message.includes('"role"') && message.includes('"content"') && message.length > 5000) {
      return {
        message: message.substring(0, 300) + '... [内容过长已截断 - 可能包含完整元素树]',
        meta: { ...meta, truncated: true },
      };
    }
  }

  // 如果包含 openaiOptions 且内容过长，简化
  if (meta?.openaiOptions?.messages) {
    const messages = meta.openaiOptions.messages;
    const filteredMessages = messages.map((msg: any) => {
      if (msg.content && typeof msg.content === 'string' && msg.content.length > 500) {
        // 检查是否包含 Accessibility Tree
        if (msg.content.includes('Accessibility Tree') || msg.content.includes('accessibility tree')) {
          return {
            ...msg,
            content: msg.content.substring(0, 200) + '... [内容过长已截断 - 包含 Accessibility Tree]',
          };
        }
        return {
          ...msg,
          content: msg.content.substring(0, 300) + '... [内容过长已截断]',
        };
      }
      return msg;
    });
    return {
      message,
      meta: { ...meta, openaiOptions: { ...meta.openaiOptions, messages: filteredMessages } },
    };
  }

  // 如果 meta 中包含长字符串内容，检查并截断
  if (meta?.content && typeof meta.content === 'string' && meta.content.length > 1000) {
    if (meta.content.includes('Accessibility Tree') || meta.content.includes('accessibility tree')) {
      return {
        message,
        meta: {
          ...meta,
          content: meta.content.substring(0, 200) + '... [内容过长已截断 - 包含 Accessibility Tree]',
          truncated: true,
        },
      };
    }
  }

  return { message, meta };
}

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
  transports: [errorLogTransport, combinedLogTransport],
});

// If not in production, log to console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          // 应用日志过滤器
          const filtered = filterLongLogs(String(message), meta);
          let msg = `${timestamp} [${service}] ${level}: ${filtered.message}`;
          if (Object.keys(filtered.meta).length > 0) {
            // 如果元数据被截断，添加提示
            const metaStr = JSON.stringify(filtered.meta);
            // 如果元数据字符串过长，也截断
            if (metaStr.length > 500) {
              msg += ` ${metaStr.substring(0, 500)}... [元数据过长已截断]`;
            } else {
              msg += ` ${metaStr}`;
            }
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
            // 应用日志过滤器
            const filtered = filterLongLogs(String(message), meta);
            let msg = `${timestamp} [${service}]${projectId ? ` [Project:${projectId}]` : ''} ${level}: ${filtered.message}`;
            if (Object.keys(filtered.meta).length > 0) {
              // 如果元数据被截断，添加提示
              const metaStr = JSON.stringify(filtered.meta);
              // 如果元数据字符串过长，也截断
              if (metaStr.length > 500) {
                msg += ` ${metaStr.substring(0, 500)}... [元数据过长已截断]`;
              } else {
                msg += ` ${metaStr}`;
              }
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
