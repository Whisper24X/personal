// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateBusinessLineDto } from './create-business-line.dto';

export class UpdateBusinessLineDto extends PartialType(CreateBusinessLineDto) {}
