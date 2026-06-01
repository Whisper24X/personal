import { PartialType } from '@nestjs/swagger';
import { CreateProjectCustomRoleDto } from './create-project-custom-role.dto';

export class UpdateProjectCustomRoleDto extends PartialType(
  CreateProjectCustomRoleDto,
) {}
