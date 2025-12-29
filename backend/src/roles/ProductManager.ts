/**
 * Product Manager Role
 * Creates Product Requirements Documents (PRD) from user ideas
 */

import { IRoleConfig, ACTION_WRITE_REQUIREMENT_SPEC } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WritePRD } from '../actions/WritePRD';
import { SearchEnhancedQA } from '../actions/SearchEnhancedQA';

export class ProductManager extends Role {
  constructor(context: Context, name: string = 'ProductManager') {
    const config: IRoleConfig = {
      name,
      profile: 'ProductManager',
      goal: 'Create comprehensive Product Requirements Document (PRD) from requirement spec',
      constraints: 'Focus on user needs, market analysis, and clear feature specifications',
      description: 'Experienced product manager who transforms requirement specs into detailed PRD',
    };
    
    super(config, context);
    
    // Watch for requirement spec completion (from Salesperson)
    this.watch([ACTION_WRITE_REQUIREMENT_SPEC]);
    
    // Set actions - WritePRD and SearchEnhancedQA as per PRD
    this.setActions([new WritePRD(), new SearchEnhancedQA()]);
  }
}

export default ProductManager;

