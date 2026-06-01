/**
 * Architect Role
 * Designs system architecture from PRD
 */

import { IRoleConfig, ACTION_WRITE_PRD } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteDesign } from '../actions/WriteDesign';
import { DesignReview } from '../actions/DesignReview';
import { ImproveDesign } from '../actions/ImproveDesign';

export class Architect extends Role {
  constructor(context: Context, name: string = 'Architect') {
    const config: IRoleConfig = {
      name,
      profile: 'Architect',
      goal: 'Design comprehensive system architecture and technical specifications from PRD, including system architecture, technology stack selection, data structures, API design, and architecture diagrams',
      constraints:
        'Follow best practices, ensure scalability and maintainability, consider security and performance from the start, use appropriate design patterns, and generate Mermaid diagrams for visualization',
      description:
        'Senior architect who specializes in system architecture design, technology selection, data structure design, API design, and creates robust, scalable system designs with comprehensive documentation and Mermaid diagrams',
    };

    super(config, context);

    // Watch for PRD completion
    this.watch([ACTION_WRITE_PRD]);

    // Set actions: WriteDesign -> DesignReview -> ImproveDesign
    this.setActions([new WriteDesign(), new DesignReview(), new ImproveDesign()]);
  }
}

export default Architect;
