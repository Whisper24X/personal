import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class MaterializeTasksDto {
  @ApiProperty({
    type: [String],
    description: '要新建任务的计划子任务 ID 列表（goal_plan_sub_tasks.id）',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  planSubTaskIds: string[];
}
