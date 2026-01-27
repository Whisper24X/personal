/**
 * @api {Class} Logger Logger
 * @apiName Logger
 * @apiGroup Logger
 * @apiDescription 通用的日志库，支持 Node.js 和浏览器环境，提供日志级别控制、格式化、存储和远程发送等功能。
 *
 * @apiParam {Object} options 配置参数对象。
 * @apiParam {String} [options.level="info"] 日志输出级别，可选值为 'debug'、'info'、'warn'、'error'。
 * @apiParam {Boolean} [options.showTimestamp=true] 是否在日志中显示时间戳。
 * @apiParam {Boolean} [options.logToConsole=true] 是否将日志输出到控制台。
 * @apiParam {Boolean} [options.logToStorage=false] 是否将日志存储到浏览器的 localStorage 中。
 * @apiParam {Boolean} [options.logToServer=false] 是否将日志发送到远程服务器。
 * @apiParam {String} [options.serverUrl=""] 远程服务器 URL，用于发送日志。
 * @apiParam {Object} [options.context={}] 全局日志上下文信息，用于在每条日志中添加通用的上下文（如用户ID、会话ID等）。
 * @apiParam {Function} [options.filter=null] 日志过滤函数，用于根据自定义条件过滤日志。
 */

interface LoggerOptions {
    level?: 'debug' | 'info' | 'warn' | 'error';
    showTimestamp?: boolean;
    logToConsole?: boolean;
    logToStorage?: boolean;
    logToServer?: boolean;
    serverUrl?: string;
    context?: Record<string, any>;
    filter?: ((level: string, ...args: any[]) => boolean) | null;
}

export default class Logger {
    private levels: string[] = ['debug', 'info', 'warn', 'error'];
    private currentLevel: string;
    private showTimestamp: boolean;
    private logToConsole: boolean;
    private logToStorage: boolean;
    private logToServer: boolean;
    private serverUrl: string;
    private context: Record<string, any>;
    private filter: ((level: string, ...args: any[]) => boolean) | null;
    private isNode: boolean;
    private colors: Record<string, string>;
    private nodeColors: Record<string, string>;

    constructor(options: LoggerOptions = {}) {
        this.currentLevel = options.level || 'info';
        this.showTimestamp = options.showTimestamp !== undefined ? options.showTimestamp : true;
        this.logToConsole = options.logToConsole !== undefined ? options.logToConsole : true;
        this.logToStorage = options.logToStorage || false;
        this.logToServer = options.logToServer || false;
        this.serverUrl = options.serverUrl || '';
        this.context = options.context || {};
        this.filter = options.filter || null;

        // 环境检测
        this.isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

        // 日志级别的颜色配置
        this.colors = {
            debug: 'color: gray',
            info: 'color: blue',
            warn: 'color: orange',
            error: 'color: red',
        };

        this.nodeColors = {
            debug: '\x1b[90m',  // 灰色
            info: '\x1b[34m',   // 蓝色
            warn: '\x1b[33m',   // 橙色/黄色
            error: '\x1b[31m',  // 红色
            reset: '\x1b[0m'    // 重置
        };
    }

    private getTimestamp(): string {
        return new Date().toISOString();
    }

    private formatLog(level: string, args: any[]): string {
        const timestamp = this.showTimestamp ? `[${this.getTimestamp()}]` : '';
        const contextInfo = Object.keys(this.context).length > 0 ? `[Context: ${JSON.stringify(this.context)}]` : '';

        // 将所有参数转成字符串，安全处理可能包含循环引用的对象
        const formattedArgs = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    // 尝试使用 JSON.stringify，如果失败则返回对象的简单表示
                    return JSON.stringify(arg);
                } catch (error) {
                    // 对于循环引用等无法直接序列化的对象，提供简单的描述
                    if (error instanceof Error && error.message.includes('circular')) {
                        return `[Complex Object: ${arg.constructor.name}]`;
                    }
                    // 尝试使用 Object.keys 获取对象的键
                    try {
                        const keys = Object.keys(arg);
                        return `[Object with keys: ${keys.join(', ')}]`;
                    } catch (e) {
                        return '[Object cannot be stringified]';
                    }
                }
            }
            return String(arg);
        });

        return `${timestamp} ${contextInfo} [${level.toUpperCase()}]: ${formattedArgs.join(' ')}`;
    }

    private log(level: string, ...args: any[]): void {
        if (this.levels.indexOf(level) >= this.levels.indexOf(this.currentLevel)) {
            const message = this.formatLog(level, args);

            // 日志过滤器
            if (this.filter && !this.filter(level, ...args)) {
                return;
            }

            // 根据环境处理日志输出
            if (this.isNode) {
                this.logNode(level, message);
            } else {
                this.logBrowser(level, message);
            }

            // 本地存储和远程日志
            if (this.logToStorage) {
                this.saveToLocalStorage(level, message);
            }
            if (this.logToServer && this.serverUrl) {
                this.sendToServer(level, message);
            }
        }
    }


    private logNode(level: string, message: string): void {
        const color = this.nodeColors[level] || this.nodeColors.reset;
        const reset = this.nodeColors.reset;

        switch (level) {
            case 'debug':
                console.debug(`${color}${message}${reset}`);
                break;
            case 'info':
                console.info(`${color}${message}${reset}`);
                break;
            case 'warn':
                console.warn(`${color}${message}${reset}`);
                break;
            case 'error':
                console.error(`${color}${message}${reset}`);
                break;
            default:
                console.log(message);
        }
    }

    private logBrowser(level: string, message: string): void {
        const color = this.colors[level] || '';

        switch (level) {
            case 'debug':
                console.debug(`%c${message}`, color);
                break;
            case 'info':
                console.info(`%c${message}`, color);
                break;
            case 'warn':
                console.warn(`%c${message}`, color);
                break;
            case 'error':
                console.error(`%c${message}`, color);
                break;
            default:
                console.log(message);
        }
    }

    private saveToLocalStorage(level: string, message: string): void {
        const logs = JSON.parse(localStorage.getItem('logs') || '[]');
        logs.push({ level, message });
        localStorage.setItem('logs', JSON.stringify(logs));
    }

    private sendToServer(level: string, message: string): void {
        fetch(this.serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, message })
        }).catch(err => console.error('Failed to send log to server:', err));
    }

    setContext(context: Record<string, any>): void {
        this.context = { ...this.context, ...context };
    }

    setLevel(level: string): void {
        if (this.levels.includes(level)) {
            this.currentLevel = level;
        } else {
            throw new Error(`Invalid log level: ${level}`);
        }
    }

    setFilter(filterFn: (level: string, ...args: any[]) => boolean): void {
        this.filter = filterFn;
    }

    debug(...args: any[]): void {
        this.log('debug', ...args);
    }

    info(...args: any[]): void {
        this.log('info', ...args);
    }

    warn(...args: any[]): void {
        this.log('warn', ...args);
    }

    error(...args: any[]): void {
        this.log('error', ...args);
    }

    logSeparator(separator: string = '-'): void {
        const line = separator.repeat(50);
        if (this.isNode) {
            console.log(this.nodeColors.info + line + this.nodeColors.reset);
        } else {
            console.log(`%c${line}`, 'color: blue');
        }
    }

    group(label: string): void {
        console.group(label);
    }

    groupEnd(): void {
        console.groupEnd();
    }
}