import { PartialType } from '@nestjs/swagger';
import { CreateBusinessLineCustomRoleDto } from './create-business-line-custom-role.dto';

export class UpdateBusinessLineCustomRoleDto extends PartialType(
  CreateBusinessLineCustomRoleDto,
) {}
