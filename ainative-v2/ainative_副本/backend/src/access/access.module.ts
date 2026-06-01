import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RelationalBusinessLinePersistenceModule } from '../business-lines/infrastructure/persistence/relational/relational-persistence.module';
import { RelationalProjectPersistenceModule } from '../projects/infrastructure/persistence/relational/relational-persistence.module';
import { AccessService } from './access.service';

@Module({
  imports: [
    UsersModule,
    RelationalBusinessLinePersistenceModule,
    RelationalProjectPersistenceModule,
  ],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
