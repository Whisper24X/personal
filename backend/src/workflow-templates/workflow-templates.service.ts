import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from './dto/update-workflow-template.dto';
import { WorkflowTemplateRepository } from './infrastructure/persistence/workflow-template.repository';
import { WorkflowTemplateVersionRepository } from './infrastructure/persistence/workflow-template-version.repository';
import { WorkflowTemplate } from './domain/workflow-template';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { FindAllWorkflowTemplatesDto } from './dto/find-all-workflow-templates.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { WorkflowTemplateVersion } from './domain/workflow-template-version';
import { WorkflowTemplateNodeDto } from './dto/workflow-template-node.dto';
import { WorkflowTemplateMode } from './dto/workflow-template-mode.enum';
import { ReorderWorkflowTemplateNodesDto } from './dto/reorder-workflow-template-nodes.dto';

@Injectable()
export class WorkflowTemplatesService {
  constructor(
    private readonly workflowTemplateRepository: WorkflowTemplateRepository,
    private readonly workflowTemplateVersionRepository: WorkflowTemplateVersionRepository,
  ) {}

  async create(
    createWorkflowTemplateDto: CreateWorkflowTemplateDto,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate> {
    this.ensureAdmin(currentUser);
    this.ensureValidNodes(
      createWorkflowTemplateDto.nodes,
      createWorkflowTemplateDto.mode,
    );

    const existedTemplate = await this.workflowTemplateRepository.findByName(
      createWorkflowTemplateDto.name,
    );

    if (existedTemplate) {
      throw new ConflictException('Workflow template name already exists');
    }

    const normalizedNodes = this.normalizeNodes(
      createWorkflowTemplateDto.nodes,
    );

    const template = await this.workflowTemplateRepository.create({
      name: createWorkflowTemplateDto.name,
      description: createWorkflowTemplateDto.description ?? null,
      mode: createWorkflowTemplateDto.mode,
      isActive: createWorkflowTemplateDto.isActive ?? true,
      nodesJson: normalizedNodes,
      latestVersion: 0,
      createdBy: currentUser.sub,
    });

    await this.publishTemplateVersion(template.id, currentUser);

    const createdTemplate = await this.workflowTemplateRepository.findById(
      template.id,
    );

    if (!createdTemplate) {
      throw new NotFoundException('Workflow template not found');
    }

    return createdTemplate;
  }

  async findAllWithPagination(
    query: FindAllWorkflowTemplatesDto,
  ): Promise<WorkflowTemplate[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    return this.workflowTemplateRepository.findAllWithPagination({
      paginationOptions,
      keyword: query.keyword,
      isActive: query.isActive,
    });
  }

  async findById(id: string): Promise<WorkflowTemplate | null> {
    return this.workflowTemplateRepository.findById(id);
  }

  async update(
    id: string,
    updateWorkflowTemplateDto: UpdateWorkflowTemplateDto,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate> {
    this.ensureAdmin(currentUser);

    const existedTemplate = await this.workflowTemplateRepository.findById(id);

    if (!existedTemplate) {
      throw new NotFoundException('Workflow template not found');
    }

    if (
      updateWorkflowTemplateDto.name &&
      updateWorkflowTemplateDto.name !== existedTemplate.name
    ) {
      const duplicatedTemplate =
        await this.workflowTemplateRepository.findByName(
          updateWorkflowTemplateDto.name,
        );

      if (duplicatedTemplate) {
        throw new ConflictException('Workflow template name already exists');
      }
    }

    const nextMode = updateWorkflowTemplateDto.mode ?? existedTemplate.mode;

    if (updateWorkflowTemplateDto.nodes) {
      this.ensureValidNodes(updateWorkflowTemplateDto.nodes, nextMode);
    }

    const updatedTemplate = await this.workflowTemplateRepository.update(id, {
      ...(updateWorkflowTemplateDto.name !== undefined
        ? { name: updateWorkflowTemplateDto.name }
        : {}),
      ...(updateWorkflowTemplateDto.description !== undefined
        ? { description: updateWorkflowTemplateDto.description }
        : {}),
      ...(updateWorkflowTemplateDto.mode !== undefined
        ? { mode: updateWorkflowTemplateDto.mode }
        : {}),
      ...(updateWorkflowTemplateDto.nodes !== undefined
        ? { nodesJson: this.normalizeNodes(updateWorkflowTemplateDto.nodes) }
        : {}),
      ...(updateWorkflowTemplateDto.isActive !== undefined
        ? { isActive: updateWorkflowTemplateDto.isActive }
        : {}),
    });

    if (!updatedTemplate) {
      throw new NotFoundException('Workflow template not found');
    }

    return updatedTemplate;
  }

  async reorderNodes(
    templateId: string,
    reorderDto: ReorderWorkflowTemplateNodesDto,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate> {
    this.ensureAdmin(currentUser);

    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    this.ensureValidNodes(reorderDto.nodes, template.mode);

    const updatedTemplate = await this.workflowTemplateRepository.update(
      template.id,
      {
        nodesJson: this.normalizeNodes(reorderDto.nodes),
      },
    );

    if (!updatedTemplate) {
      throw new NotFoundException('Workflow template not found');
    }

    return updatedTemplate;
  }

  async remove(id: string, currentUser: JwtPayloadType): Promise<void> {
    this.ensureAdmin(currentUser);

    const existedTemplate = await this.workflowTemplateRepository.findById(id);

    if (!existedTemplate) {
      throw new NotFoundException('Workflow template not found');
    }

    await this.workflowTemplateRepository.remove(id);
  }

  async publishTemplateVersion(
    templateId: string,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplateVersion> {
    this.ensureAdmin(currentUser);

    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    const nextVersion = template.latestVersion + 1;

    const version = await this.workflowTemplateVersionRepository.create({
      templateId: template.id,
      version: nextVersion,
      name: template.name,
      description: template.description,
      mode: template.mode,
      nodesJson: template.nodesJson,
      publishedBy: currentUser.sub,
    });

    await this.workflowTemplateRepository.update(template.id, {
      latestVersion: nextVersion,
    });

    return version;
  }

  async findVersions(
    templateId: string,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplateVersion[]> {
    this.ensureAdmin(currentUser);

    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    return this.workflowTemplateVersionRepository.findByTemplateId(templateId);
  }

  async getVersionForTask({
    templateId,
    version,
  }: {
    templateId: string;
    version?: number;
  }): Promise<WorkflowTemplateVersion> {
    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    if (!template.isActive) {
      throw new ConflictException('Workflow template is disabled');
    }

    const resolvedVersion =
      version !== undefined
        ? await this.workflowTemplateVersionRepository.findByTemplateIdAndVersion(
            templateId,
            version,
          )
        : await this.workflowTemplateVersionRepository.findLatestByTemplateId(
            templateId,
          );

    if (!resolvedVersion) {
      throw new NotFoundException('Workflow template version not found');
    }

    return resolvedVersion;
  }

  private ensureValidNodes(
    nodes: WorkflowTemplateNodeDto[],
    mode: WorkflowTemplateMode,
  ): void {
    const nodeOrderSet = new Set<number>();
    const sortedOrders = [...nodes]
      .map((node) => node.nodeOrder)
      .sort((left, right) => left - right);

    for (const node of nodes) {
      if (nodeOrderSet.has(node.nodeOrder)) {
        throw new ConflictException(
          'Workflow template node_order must be unique',
        );
      }

      nodeOrderSet.add(node.nodeOrder);
    }

    const hasStartNode = sortedOrders[0] === 1;

    if (!hasStartNode) {
      throw new ConflictException(
        'Workflow template requires node_order starting from 1',
      );
    }

    for (let index = 0; index < sortedOrders.length; index += 1) {
      const expectedNodeOrder = index + 1;
      if (sortedOrders[index] !== expectedNodeOrder) {
        throw new ConflictException(
          'Workflow template node_order must be continuous from 1',
        );
      }
    }

    if (mode === WorkflowTemplateMode.conversation && nodes.length !== 1) {
      throw new ConflictException(
        'Conversation mode requires exactly one node',
      );
    }
  }

  private normalizeNodes(
    nodes: WorkflowTemplateNodeDto[],
  ): WorkflowTemplateNodeDto[] {
    return [...nodes]
      .sort((left, right) => left.nodeOrder - right.nodeOrder)
      .map((node, index) => ({
        ...node,
        nodeOrder: index + 1,
      }));
  }

  private ensureAdmin(currentUser: JwtPayloadType): void {
    if (!currentUser.roles?.includes('admin')) {
      throw new ForbiddenException('forbiddenWorkflowTemplateManage');
    }
  }
}
