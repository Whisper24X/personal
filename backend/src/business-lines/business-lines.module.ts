import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { BusinessLinesService } from './business-lines.service';
import { BusinessLinesController } from './business-lines.controller';
import { RelationalBusinessLinePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalBusinessLinePersistenceModule,
    UsersModule,
  ],
  controllers: [BusinessLinesController],
  providers: [BusinessLinesService],
  exports: [BusinessLinesService, RelationalBusinessLinePersistenceModule],
})
export class BusinessLinesModule {}
