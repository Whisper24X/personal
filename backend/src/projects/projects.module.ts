import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { RelationalProjectPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';
import { BusinessLinesModule } from '../business-lines/business-lines.module';
import { RelationalTaskPersistenceModule } from '../tasks/infrastructure/persistence/relational/relational-persistence.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [
    RelationalProjectPersistenceModule,
    RelationalTaskPersistenceModule,
    UsersModule,
    BusinessLinesModule,
    AccessModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService, RelationalProjectPersistenceModule],
})
export class ProjectsModule {}
