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
import { WorkflowTemplate } from './domain/workflow-template';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { FindAllWorkflowTemplatesDto } from './dto/find-all-workflow-templates.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { WorkflowTemplateNodeDto } from './dto/workflow-template-node.dto';
import { ReorderWorkflowTemplateNodesDto } from './dto/reorder-workflow-template-nodes.dto';
import { WorkflowTemplateScope } from './dto/workflow-template-scope.enum';
import { ProjectAccessService } from '../projects/project-access.service';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { BusinessLineMemberRepository } from '../business-lines/infrastructure/persistence/business-line-member.repository';
import { BusinessLineCustomRoleRepository } from '../business-lines/infrastructure/persistence/business-line-custom-role.repository';
import { canReadWorkflowByCapabilities } from '../access/access.constants';

@Injectable()
export class WorkflowTemplatesService {
  constructor(
    private readonly workflowTemplateRepository: WorkflowTemplateRepository,
    private readonly projectAccessService: ProjectAccessService,
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly businessLineCustomRoleRepository: BusinessLineCustomRoleRepository,
  ) {}

  async create(
    createWorkflowTemplateDto: CreateWorkflowTemplateDto,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate> {
    const scope = createWorkflowTemplateDto.scope;
    let businessLineId: string | null = null;
    let projectId: string | null = null;

    if (scope === WorkflowTemplateScope.businessLine) {
      businessLineId = createWorkflowTemplateDto.businessLineId ?? null;
      if (!businessLineId) {
        throw new BadRequestException(
          'businessLineId is required for business_line scope',
        );
      }
      if (createWorkflowTemplateDto.projectId) {
        throw new BadRequestException(
          'projectId is only supported for project scope',
        );
      }
      await this.ensureCanManageBusinessLineTemplates(
        businessLineId,
        currentUser,
      );
    } else if (scope === WorkflowTemplateScope.project) {
      projectId = createWorkflowTemplateDto.projectId ?? null;
      if (!projectId) {
        throw new BadRequestException(
          'projectId is required for project scope',
        );
      }
      if (createWorkflowTemplateDto.businessLineId) {
        throw new BadRequestException(
          'businessLineId is only supported for business_line scope',
        );
      }
      const project = await this.projectAccessService.assertProjectCapability(
        projectId,
        currentUser,
        'project.workflow.read',
      );

      businessLineId = project.businessLineId;
    } else {
      throw new BadRequestException(
        'scope only supports business_line or project',
      );
    }

    this.ensureValidNodes(createWorkflowTemplateDto.nodes);

    const existedTemplate = await this.workflowTemplateRepository.findByName(
      createWorkflowTemplateDto.name,
      scope === WorkflowTemplateScope.businessLine
        ? {
            scope,
            businessLineId,
          }
        : {
            scope,
            projectId,
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
      scope,
      businessLineId,
      projectId,
      isActive: createWorkflowTemplateDto.isActive ?? true,
      nodesJson: normalizedNodes,
      createdBy: currentUser.sub,
    });

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

    const scope = query.scope;
    let businessLineId = query.businessLineId;
    const projectId = query.projectId;
    let includeGlobal = false;

    if (projectId) {
      const project = await this.projectAccessService.assertProjectCapability(
        projectId,
        currentUser,
        'project.workflow.read',
      );
      if (businessLineId && businessLineId !== project.businessLineId) {
        throw new BadRequestException(
          'businessLineId does not match project business line',
        );
      }
      businessLineId = project.businessLineId;
      includeGlobal = !scope;
    } else if (businessLineId) {
      if (scope === WorkflowTemplateScope.project) {
        throw new BadRequestException(
          'projectId is required for project scope',
        );
      }
      await this.ensureCanReadBusinessLineWorkflow(businessLineId, currentUser);
      includeGlobal = !scope;
    } else if (scope === WorkflowTemplateScope.businessLine) {
      if (!this.isAdmin(currentUser)) {
        throw new ForbiddenException('forbiddenWorkflowTemplate');
      }
    } else if (scope === WorkflowTemplateScope.project) {
      if (!this.isAdmin(currentUser)) {
        throw new ForbiddenException('forbiddenWorkflowTemplate');
      }
    } else if (!this.isAdmin(currentUser)) {
      return [];
    }

    return this.workflowTemplateRepository.findAllWithPagination({
      paginationOptions,
      keyword: query.keyword,
      isActive: query.isActive,
      scope,
      businessLineId,
      projectId,
      includeGlobal,
      excludeGlobal: true,
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
      updateWorkflowTemplateDto.projectId !== undefined &&
      updateWorkflowTemplateDto.projectId !==
        (existedTemplate.projectId ?? undefined)
    ) {
      throw new ConflictException(
        'Workflow template projectId cannot be changed',
      );
    }

    if (
      updateWorkflowTemplateDto.name &&
      updateWorkflowTemplateDto.name !== existedTemplate.name
    ) {
      const duplicatedTemplate =
        await this.workflowTemplateRepository.findByName(
          updateWorkflowTemplateDto.name,
          existedTemplate.scope === WorkflowTemplateScope.businessLine
            ? {
                scope: existedTemplate.scope,
                businessLineId: existedTemplate.businessLineId ?? null,
              }
            : {
                scope: existedTemplate.scope,
                projectId: existedTemplate.projectId ?? null,
              },
        );

      if (duplicatedTemplate) {
        throw new ConflictException('Workflow template name already exists');
      }
    }

    if (updateWorkflowTemplateDto.nodes) {
      this.ensureValidNodes(updateWorkflowTemplateDto.nodes);
    }

    const updatedTemplate = await this.workflowTemplateRepository.update(id, {
      ...(updateWorkflowTemplateDto.name !== undefined
        ? { name: updateWorkflowTemplateDto.name }
        : {}),
      ...(updateWorkflowTemplateDto.description !== undefined
        ? { description: updateWorkflowTemplateDto.description }
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
    this.ensureValidNodes(reorderDto.nodes);

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

  async getTemplateForTask({
    templateId,
    projectId,
    projectBusinessLineId,
  }: {
    templateId: string;
    projectId: string;
    projectBusinessLineId: string;
  }): Promise<WorkflowTemplate> {
    const template = await this.workflowTemplateRepository.findById(templateId);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    if (template.scope === WorkflowTemplateScope.global) {
      throw new ForbiddenException('forbiddenWorkflowTemplate');
    }

    if (
      template.scope === WorkflowTemplateScope.businessLine &&
      template.businessLineId !== projectBusinessLineId
    ) {
      throw new ForbiddenException('forbiddenWorkflowTemplate');
    }

    if (
      template.scope === WorkflowTemplateScope.project &&
      template.projectId !== projectId
    ) {
      throw new ForbiddenException('forbiddenWorkflowTemplate');
    }

    if (!template.isActive) {
      throw new ConflictException('Workflow template is disabled');
    }
    return template;
  }

  private ensureValidNodes(nodes: WorkflowTemplateNodeDto[]): void {
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

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async ensureCanManageBusinessLineTemplates(
    businessLineId: string,
    _currentUser: JwtPayloadType,
  ): Promise<void> {
    void _currentUser;
    await this.ensureBusinessLineExists(businessLineId);
  }

  private async ensureCanReadBusinessLineWorkflow(
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

    const role = await this.businessLineCustomRoleRepository.findById(
      member.roleId,
    );

    if (
      !role ||
      role.businessLineId !== businessLineId ||
      !canReadWorkflowByCapabilities(role.capabilities)
    ) {
      throw new ForbiddenException('forbiddenWorkflowTemplate');
    }
  }

  private async ensureCanAccessTemplate(
    template: WorkflowTemplate,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    if (template.scope === WorkflowTemplateScope.global) {
      return;
    }

    if (template.scope === WorkflowTemplateScope.businessLine) {
      if (!template.businessLineId) {
        throw new NotFoundException(
          'Workflow template business line not found',
        );
      }

      await this.ensureBusinessLineExists(template.businessLineId);
      return;
    }

    if (!template.projectId) {
      throw new NotFoundException('Workflow template project not found');
    }

    await this.projectAccessService.assertProjectCapability(
      template.projectId,
      currentUser,
      'project.workflow.read',
    );
  }

  private async ensureCanManageTemplate(
    template: WorkflowTemplate,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    if (template.scope === WorkflowTemplateScope.global) {
      return;
    }

    if (template.scope === WorkflowTemplateScope.businessLine) {
      if (!template.businessLineId) {
        throw new NotFoundException(
          'Workflow template business line not found',
        );
      }

      await this.ensureCanManageBusinessLineTemplates(
        template.businessLineId,
        currentUser,
      );
      return;
    }

    if (!template.projectId) {
      throw new NotFoundException('Workflow template project not found');
    }

    await this.projectAccessService.assertProjectCapability(
      template.projectId,
      currentUser,
      'project.workflow.read',
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
