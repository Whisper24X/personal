import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsUUID, ValidateNested } from 'class-validator';

export class TaskDependencyEdgeDto {
  @ApiProperty()
  @IsUUID()
  predecessorTaskId: string;

  @ApiProperty()
  @IsUUID()
  successorTaskId: string;
}

export class ReplaceTaskDependenciesDto {
  @ApiProperty({
    type: [TaskDependencyEdgeDto],
    description: '空数组表示清除全部依赖边',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskDependencyEdgeDto)
  edges: TaskDependencyEdgeDto[];
}
