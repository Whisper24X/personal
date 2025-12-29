/**
 * Architect Role
 * Designs system architecture from PRD
 */

import { IRoleConfig, ACTION_WRITE_PRD } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteDesign } from '../actions/WriteDesign';

export class Architect extends Role {
  constructor(context: Context, name: string = 'Architect') {
    const config: IRoleConfig = {
      name,
      profile: 'Architect',
      goal: 'Design comprehensive system architecture and technical specifications',
      constraints: 'Follow best practices, ensure scalability and maintainability',
      description: 'Senior architect who creates robust system designs',
    };
    
    super(config, context);
    
    // Watch for PRD completion
    this.watch([ACTION_WRITE_PRD]);
    
    // Set actions
    this.setActions([new WriteDesign()]);
  }
}

export default Architect;

