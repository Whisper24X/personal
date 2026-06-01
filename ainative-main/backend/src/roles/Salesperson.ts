/**
 * Salesperson Role
 * Responsible for requirement collection and market research, generating Market Research Document (MRD)
 */

import { IRoleConfig } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteMRD } from '../actions/WriteMRD';
import { MRDReview } from '../actions/MRDReview';
import { ImproveMRD } from '../actions/ImproveMRD';

export class Salesperson extends Role {
  constructor(context: Context, name: string = 'Salesperson') {
    const config: IRoleConfig = {
      name,
      profile: 'Salesperson',
      goal: 'Create comprehensive Market Research Document (MRD) from user requirements',
      constraints: 'Focus on user needs, market research, target value analysis, requirement value analysis, and business process analysis. Transform user requirements into detailed MRD',
      description: 'Experienced requirement collection and market research expert who transforms user requirements into comprehensive Market Research Documents (MRD)',
    };

    super(config, context);

    // Watch for initial user requirements (User messages)
    // Salesperson is the first role in the workflow, so it needs to listen for User messages
    this.watch(['User']);

    // Actions: WriteMRD -> MRDReview -> ImproveMRD
    this.setActions([new WriteMRD(), new MRDReview(), new ImproveMRD()]);
  }
}

