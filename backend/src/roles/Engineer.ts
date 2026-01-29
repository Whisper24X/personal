/**
 * Engineer Role
 * 使用Cursor CLI执行代码生成
 */

import { IRoleConfig, ACTION_WRITE_DESIGN, ACTION_WRITE_PRD, ACTION_BREAKDOWN_TASKS } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteCode } from '../actions/WriteCode';
import { ImproveCode } from '../actions/ImproveCode';
import { Deploy } from '../actions/Deploy';

export class Engineer extends Role {
  constructor(context: Context, name: string = 'Engineer') {
    const config: IRoleConfig = {
      name,
      profile: 'Engineer',
      goal: 'Implement high-quality code based on ProductManager and Architect outputs',
      constraints: 'Follow coding standards, write clean and maintainable code',
      description: 'Skilled engineer who brings designs to life through code',
    };

    super(config, context);

    // 监听 ProductManager 和 Architect 的输出
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS]);

    // 设置 actions: WriteCode -> ImproveCode -> Deploy
    this.setActions([new WriteCode(), new ImproveCode(), new Deploy()]);
  }
}

export default Engineer;
