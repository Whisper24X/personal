import { ApiProperty } from '@nestjs/swagger';

/** 项目任务按状态聚合（数据库 COUNT，用于仪表盘） */
export class TaskStatusCountsDto {
  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: Number })
  todo: number;

  @ApiProperty({ type: Number })
  in_progress: number;

  @ApiProperty({ type: Number })
  in_review: number;

  @ApiProperty({ type: Number })
  done: number;

  @ApiProperty({ type: Number, description: '非删除任务总数' })
  total: number;
}
