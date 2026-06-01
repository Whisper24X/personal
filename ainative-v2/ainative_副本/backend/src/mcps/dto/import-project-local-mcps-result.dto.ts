import { ApiProperty } from '@nestjs/swagger';

export class ImportProjectLocalMcpsResultDto {
  @ApiProperty({ type: Number, example: 2 })
  importedCount: number;

  @ApiProperty({ type: Number, example: 1 })
  overwrittenCount: number;
}
