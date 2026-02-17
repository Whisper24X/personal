import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { RelationalProjectPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';
import { BusinessLinesModule } from '../business-lines/business-lines.module';

@Module({
  imports: [
    RelationalProjectPersistenceModule,
    UsersModule,
    BusinessLinesModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService, RelationalProjectPersistenceModule],
})
export class ProjectsModule {}
