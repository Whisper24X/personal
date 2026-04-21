import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ScanDatabaseTablesDto {
  @ApiProperty({ type: String, example: '10.8.8.110' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiPropertyOptional({ type: Number, example: 5432, default: 5432 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({
    type: String,
    example: 'postgres',
    default: 'postgres',
  })
  @IsOptional()
  @IsString()
  adminUser?: string;

  @ApiProperty({
    type: String,
    example: 'yanxue_ainative',
    description:
      '基准数据库名（即当前共享环境使用的源库，非 task_ 开头的隔离库）',
  })
  @IsString()
  @IsNotEmpty()
  sourceDatabase: string;

  @ApiProperty({ description: '数据库管理员密码', format: 'password' })
  @IsString()
  @IsNotEmpty()
  adminPassword: string;
}
