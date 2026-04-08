import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { BusinessLineAgentToolConfigService } from './business-line-agent-tool-config.service';
import { BusinessLineCustomRoleService } from './business-line-custom-role.service';
import { BusinessLineInvitationService } from './business-line-invitation.service';
import { BusinessLineLifecycleService } from './business-line-lifecycle.service';
import { BusinessLineLocalAssetsService } from './business-line-local-assets.service';
import { BusinessLineMemberManagementService } from './business-line-member-management.service';
import { BusinessLineMembershipService } from './business-line-membership.service';
import { BusinessLineProjectRoleAssignmentService } from './business-line-project-role-assignment.service';
import { BusinessLineProjectRoleCatalogService } from './business-line-project-role-catalog.service';
import { BusinessLineRoleCatalogService } from './business-line-role-catalog.service';
import { BusinessLineRoleTemplateService } from './business-line-role-template.service';
import { BusinessLinesService } from './business-lines.service';
import { BusinessLinesController } from './business-lines.controller';
import { RelationalBusinessLinePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';
import { RelationalProjectPersistenceModule } from '../projects/infrastructure/persistence/relational/relational-persistence.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalBusinessLinePersistenceModule,
    RelationalProjectPersistenceModule,
    UsersModule,
    AccessModule,
  ],
  controllers: [BusinessLinesController],
  providers: [
    BusinessLinesService,
    BusinessLineAgentToolConfigService,
    BusinessLineCustomRoleService,
    BusinessLineInvitationService,
    BusinessLineLifecycleService,
    BusinessLineLocalAssetsService,
    BusinessLineMemberManagementService,
    BusinessLineMembershipService,
    BusinessLineProjectRoleAssignmentService,
    BusinessLineProjectRoleCatalogService,
    BusinessLineRoleCatalogService,
    BusinessLineRoleTemplateService,
  ],
  exports: [BusinessLinesService, RelationalBusinessLinePersistenceModule],
})
export class BusinessLinesModule {}
