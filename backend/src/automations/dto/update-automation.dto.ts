import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAutomationDto } from './create-automation.dto';

export class UpdateAutomationDto extends PartialType(
  OmitType(CreateAutomationDto, ['projectId'] as const),
) {}
