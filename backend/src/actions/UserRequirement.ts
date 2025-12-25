/**
 * User Requirement Action
 * Placeholder for initial user input
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';

export class UserRequirement extends BaseAction {
  constructor() {
    super('UserRequirement', 'Initial user requirement or idea');
  }

  async run(requirement: string): Promise<IActionOutput> {
    return {
      content: requirement,
      data: {
        type: 'requirement',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

export default UserRequirement;

