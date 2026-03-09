import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class TaskConfigDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  workflowTemplateId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cliToolId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  agentToolConfigId?: string;
}

export class TaskNodeConfigDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cliToolId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  agentToolConfigId?: string;
}
