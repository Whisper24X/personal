import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetLocalMcpConfigDto {
  @ApiProperty({ type: String, example: 'filesystem' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: String,
    example: '/Users/fuzhifei/.ainative/data/{businessLineId}/mcp/mcp.json',
  })
  @IsString()
  @IsNotEmpty()
  sourcePath: string;
}
