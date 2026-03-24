import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class MaterializeTasksDto {
  @ApiProperty({ type: [String], description: '要物化的计划项 ID 列表' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  planItemIds: string[];
}
