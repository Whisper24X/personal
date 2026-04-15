import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 项目主仓库内将 head 分支合并入 base 分支的结果（与任务 Git 合并结果字段对齐） */
export class GitBranchMergeResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ type: [String] })
  conflicts?: string[];
}
