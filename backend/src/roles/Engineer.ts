/**
 * Engineer Role
 * Implements code based on design documents
 */

import { IRoleConfig, ACTION_WRITE_DESIGN } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteCode } from '../actions/WriteCode';

export class Engineer extends Role {
  constructor(context: Context, name: string = 'Charlie') {
    const config: IRoleConfig = {
      name,
      profile: 'Engineer',
      goal: 'Implement high-quality code based on design specifications',
      constraints: 'Follow coding standards, write clean and maintainable code',
      description: 'Skilled engineer who brings designs to life through code',
    };
    
    super(config, context);
    
    // Watch for design completion
    this.watch([ACTION_WRITE_DESIGN]);
    
    // Set actions
    this.setActions([new WriteCode()]);
  }
}

export default Engineer;

