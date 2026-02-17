import { ApiProperty } from '@nestjs/swagger';
import { TaskArtifactType } from '../dto/task-artifact-type.enum';

export class TaskArtifact {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  taskId: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  taskNodeId?: string | null;

  @ApiProperty({ enum: TaskArtifactType, enumName: 'TaskArtifactType' })
  artifactType: TaskArtifactType;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  downloadUrl?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  content?: string | null;

  @ApiProperty({ type: Object, required: false, nullable: true })
  metadata?: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;
}
