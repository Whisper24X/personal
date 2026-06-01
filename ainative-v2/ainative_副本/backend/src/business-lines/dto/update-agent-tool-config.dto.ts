import { PartialType } from '@nestjs/swagger';
import { CreateAgentToolConfigDto } from './create-agent-tool-config.dto';

export class UpdateAgentToolConfigDto extends PartialType(
  CreateAgentToolConfigDto,
) {}
