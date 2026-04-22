import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CurrentAccessUserDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  username: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  nickname?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  avatar?: string | null;
}

export class CurrentAccessContextDto {
  @ApiPropertyOptional({ type: String })
  businessLineId?: string;

  @ApiPropertyOptional({ type: String })
  projectId?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  businessRole?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  projectRole?: string | null;
}

export class CurrentAccessVisibilityDto {
  @ApiProperty({ type: [String] })
  visibleBusinessLineIds: string[];

  @ApiProperty({ type: [String] })
  visibleProjectIds: string[];
}

export class CurrentAccessDto {
  @ApiProperty({ type: CurrentAccessUserDto })
  user: CurrentAccessUserDto;

  @ApiProperty({ type: CurrentAccessContextDto })
  currentContext: CurrentAccessContextDto;

  @ApiProperty({ type: [String] })
  capabilities: string[];

  @ApiProperty({ type: CurrentAccessVisibilityDto })
  visibility: CurrentAccessVisibilityDto;

  @ApiProperty({ type: Boolean })
  isAdmin: boolean;
}
