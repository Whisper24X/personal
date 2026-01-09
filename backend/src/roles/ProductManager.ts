/**
 * Product Manager Role
 * Creates Product Requirements Documents (PRD) from Market Research Document (MRD)
 */

import { IRoleConfig, ACTION_WRITE_MRD } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WritePRD } from '../actions/WritePRD';
import { SearchEnhancedQA } from '../actions/SearchEnhancedQA';
import { PRDReview } from '../actions/PRDReview';
import { ImprovePRD } from '../actions/ImprovePRD';

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
    // Use string literal to ensure it's not undefined
    this.watch([ACTION_WRITE_MRD || 'WriteMRD']);

    // Set actions - WritePRD, SearchEnhancedQA, PRDReview, and ImprovePRD
    this.setActions([new WritePRD(), new SearchEnhancedQA(), new PRDReview(), new ImprovePRD()]);
  }
}

export default ProductManager;

