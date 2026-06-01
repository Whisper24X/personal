import { ApiPropertyOptional } from '@nestjs/swagger';

export class GoalPlanItemPrLinkDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  url?: string | null;
}
