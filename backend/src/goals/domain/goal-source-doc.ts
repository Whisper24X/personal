import { ApiProperty } from '@nestjs/swagger';
import { GoalSourceDocType } from '../dto/goal-source-doc-type.enum';

export class GoalSourceDoc {
  @ApiProperty()
  id: string;

  @ApiProperty()
  goalId: string;

  @ApiProperty()
  projectDocPath: string;

  @ApiProperty({ enum: GoalSourceDocType, enumName: 'GoalSourceDocType' })
  docType: GoalSourceDocType;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;
}
