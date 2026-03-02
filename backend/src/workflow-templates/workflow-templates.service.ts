import {
  BadRequestException,
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
import { WorkflowTemplateScope } from './dto/workflow-template-scope.enum';
import { ProjectsService } from '../projects/projects.service';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { BusinessLineMemberRepository } from '../business-lines/infrastructure/persistence/business-line-member.repository';
import { BusinessLineMemberRole } from '../business-lines/dto/business-line-member-role.enum';

@Injectable()
export class WorkflowTemplatesService {
  constructor(
    private readonly workflowTemplateRepository: WorkflowTemplateRepository,
    private readonly workflowTemplateVersionRepository: WorkflowTemplateVersionRepository,
    private readonly projectsService: ProjectsService,
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
  ) {}

  async create(
    createWorkflowTemplateDto: CreateWorkflowTemplateDto,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate> {
    const scope =
      createWorkflowTemplateDto.scope ?? WorkflowTemplateScope.global;
    const businessLineId =
      scope === WorkflowTemplateScope.businessLine
        ? createWorkflowTemplateDto.businessLineId
        : null;

    if (scope === WorkflowTemplateScope.businessLine) {
      if (!businessLineId) {
        throw new BadRequestException(
          'businessLineId is required for business_line scope',
        );
      }
      await this.ensureCanManageBusinessLineTemplates(
        businessLineId,
        currentUser,
      );
    } else {
      this.ensureAdmin(currentUser);
      if (createWorkflowTemplateDto.businessLineId) {
        throw new BadRequestException(
          'businessLineId is only supported for business_line scope',
        );
      }
    }

    this.ensureValidNodes(
      createWorkflowTemplateDto.nodes,
      createWorkflowTemplateDto.mode,
    );

    const existedTemplate = await this.workflowTemplateRepository.findByName(
      createWorkflowTemplateDto.name,
      {
        scope,
        businessLineId,
      },
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
      scope,
      businessLineId,
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
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    let scope = query.scope;
    let businessLineId = query.businessLineId;
    let includeGlobal = false;

    if (query.projectId) {
      const project = await this.projectsService.assertCanAccessProject(
        query.projectId,
        currentUser,
      );
      businessLineId = project.businessLineId;
      includeGlobal = !scope;
    } else if (businessLineId) {
      if (scope !== WorkflowTemplateScope.global) {
        await this.ensureCanAccessBusinessLine(businessLineId, currentUser);
      }
      includeGlobal = !scope;
    } else if (scope === WorkflowTemplateScope.businessLine) {
      if (!this.isAdmin(currentUser)) {
        throw new ForbiddenException('forbiddenWorkflowTemplate');
      }
    } else {
      scope = WorkflowTemplateScope.global;
    }

    return this.workflowTemplateRepository.findAllWithPagination({
      paginationOptions,
      keyword: query.keyword,
      isActive: query.isActive,
      scope,
      businessLineId,
      includeGlobal,
    });
  }

  async findById(
    id: string,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate | null> {
    const template = await this.workflowTemplateRepository.findById(id);
    if (!template) {
      return null;
    }

    await this.ensureCanAccessTemplate(template, currentUser);
    return template;
  }

  async update(
    id: string,
    updateWorkflowTemplateDto: UpdateWorkflowTemplateDto,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate> {
    const existedTemplate = await this.workflowTemplateRepository.findById(id);

    if (!existedTemplate) {
      throw new NotFoundException('Workflow template not found');
    }

    await this.ensureCanManageTemplate(existedTemplate, currentUser);

    if (
      updateWorkflowTemplateDto.scope !== undefined &&
      updateWorkflowTemplateDto.scope !== existedTemplate.scope
    ) {
      throw new ConflictException('Workflow template scope cannot be changed');
    }

    if (
      updateWorkflowTemplateDto.businessLineId !== undefined &&
      updateWorkflowTemplateDto.businessLineId !==
        (existedTemplate.businessLineId ?? undefined)
    ) {
      throw new ConflictException(
        'Workflow template businessLineId cannot be changed',
      );
    }

    if (
      updateWorkflowTemplateDto.name &&
      updateWorkflowTemplateDto.name !== existedTemplate.name
    ) {
      const duplicatedTemplate =
        await this.workflowTemplateRepository.findByName(
          updateWorkflowTemplateDto.name,
          {
            scope: existedTemplate.scope,
            businessLineId: existedTemplate.businessLineId ?? null,
          },
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
    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    await this.ensureCanManageTemplate(template, currentUser);
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
    const existedTemplate = await this.workflowTemplateRepository.findById(id);

    if (!existedTemplate) {
      throw new NotFoundException('Workflow template not found');
    }

    await this.ensureCanManageTemplate(existedTemplate, currentUser);
    await this.workflowTemplateRepository.remove(id);
  }

  async publishTemplateVersion(
    templateId: string,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplateVersion> {
    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    await this.ensureCanManageTemplate(template, currentUser);
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
    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    await this.ensureCanAccessTemplate(template, currentUser);
    return this.workflowTemplateVersionRepository.findByTemplateId(templateId);
  }

  async getVersionForTask({
    templateId,
    version,
    projectBusinessLineId,
  }: {
    templateId: string;
    version?: number;
    projectBusinessLineId: string;
  }): Promise<WorkflowTemplateVersion> {
    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    if (
      template.scope === WorkflowTemplateScope.businessLine &&
      template.businessLineId !== projectBusinessLineId
    ) {
      throw new ForbiddenException('forbiddenWorkflowTemplate');
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
    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException('forbiddenWorkflowTemplateManage');
    }
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async ensureCanManageBusinessLineTemplates(
    businessLineId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureBusinessLineExists(businessLineId);

    if (this.isAdmin(currentUser)) {
      return;
    }

    const member =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!member) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }

    if (
      member.role !== BusinessLineMemberRole.owner &&
      member.role !== BusinessLineMemberRole.admin
    ) {
      throw new ForbiddenException('forbiddenWorkflowTemplateManage');
    }
  }

  private async ensureCanAccessBusinessLine(
    businessLineId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureBusinessLineExists(businessLineId);

    if (this.isAdmin(currentUser)) {
      return;
    }

    const member =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!member) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }
  }

  private async ensureCanAccessTemplate(
    template: WorkflowTemplate,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    if (template.scope === WorkflowTemplateScope.global) {
      return;
    }

    if (!template.businessLineId) {
      throw new NotFoundException('Workflow template business line not found');
    }

    await this.ensureCanAccessBusinessLine(
      template.businessLineId,
      currentUser,
    );
  }

  private async ensureCanManageTemplate(
    template: WorkflowTemplate,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    if (template.scope === WorkflowTemplateScope.global) {
      this.ensureAdmin(currentUser);
      return;
    }

    if (!template.businessLineId) {
      throw new NotFoundException('Workflow template business line not found');
    }

    await this.ensureCanManageBusinessLineTemplates(
      template.businessLineId,
      currentUser,
    );
  }

  private async ensureBusinessLineExists(
    businessLineId: string,
  ): Promise<void> {
    const businessLine =
      await this.businessLineRepository.findById(businessLineId);
    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }
  }
}
