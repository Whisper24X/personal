import { ApiProperty } from '@nestjs/swagger';

export class BusinessLineMemberProjectRolesDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'string',
    },
  })
  projectRoles: Record<string, string>;
}
