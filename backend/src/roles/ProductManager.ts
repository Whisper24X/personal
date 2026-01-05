/**
 * Product Manager Role
 * Creates Product Requirements Documents (PRD) from Market Research Document (MRD)
 */

import { IRoleConfig, ACTION_WRITE_MRD } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WritePRD } from '../actions/WritePRD';
import { SearchEnhancedQA } from '../actions/SearchEnhancedQA';

export class ProductManager extends Role {
  constructor(context: Context, name: string = 'ProductManager') {
    const config: IRoleConfig = {
      name,
      profile: 'ProductManager',
      goal: 'Create comprehensive Product Requirements Document (PRD) from Market Research Document (MRD)',
      constraints: 'Focus on user needs, market analysis, and clear feature specifications. Transform MRD into detailed, executable PRD',
      description: 'Experienced product manager who transforms Market Research Documents (MRD) into detailed Product Requirements Documents (PRD)',
    };
    
    super(config, context);
    
    // Watch for MRD completion (from Salesperson)
    this.watch([ACTION_WRITE_MRD]);
    
    // Set actions - WritePRD and SearchEnhancedQA as per PRD
    this.setActions([new WritePRD(), new SearchEnhancedQA()]);
  }
}

export default ProductManager;

