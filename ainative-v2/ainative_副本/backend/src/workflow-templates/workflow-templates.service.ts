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
import { ReorderWorkflowTemplateNodesDto } from './dto/reorder-workflow-template-nodes.dto';
import { FindGlobalMastersForBusinessLineDto } from './dto/find-global-masters-for-business-line.dto';
import { WorkflowTemplateScope } from './dto/workflow-template-scope.enum';
import { ProjectAccessService } from '../projects/project-access.service';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { BusinessLineMemberRepository } from '../business-lines/infrastructure/persistence/business-line-member.repository';
import { BusinessLineCustomRoleRepository } from '../business-lines/infrastructure/persistence/business-line-custom-role.repository';
import { canReadWorkflowByCapabilities } from '../access/access.constants';
import {
  ensureValidWorkflowTemplateNodes,
  normalizeWorkflowTemplateNodes,
} from './workflow-template-nodes.util';

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

    if (
      createWorkflowTemplateDto.scope !== WorkflowTemplateScope.global &&
      (createWorkflowTemplateDto.seedOnBusinessLineCreate !== undefined ||
        createWorkflowTemplateDto.businessLineSeedOrder !== undefined)
    ) {
      throw new BadRequestException(
        'seedOnBusinessLineCreate and businessLineSeedOrder are only valid for global templates',
      );
    }

    if (scope === WorkflowTemplateScope.global) {
      if (!this.isAdmin(currentUser)) {
        throw new ForbiddenException('forbiddenWorkflowTemplate');
      }
      if (
        createWorkflowTemplateDto.businessLineId ||
        createWorkflowTemplateDto.projectId
      ) {
        throw new BadRequestException(
          'businessLineId and projectId must be empty for global scope',
        );
      }
    } else if (scope === WorkflowTemplateScope.businessLine) {
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
      throw new BadRequestException('Unsupported workflow template scope');
    }

    ensureValidWorkflowTemplateNodes(createWorkflowTemplateDto.nodes);

    const existedTemplate = await this.workflowTemplateRepository.findByName(
      createWorkflowTemplateDto.name,
      scope === WorkflowTemplateScope.businessLine
        ? {
            scope,
            businessLineId,
          }
        : scope === WorkflowTemplateScope.project
          ? {
              scope,
              projectId,
            }
          : {
              scope: WorkflowTemplateScope.global,
            },
    );

    if (existedTemplate) {
      throw new ConflictException('Workflow template name already exists');
    }

    const normalizedNodes = normalizeWorkflowTemplateNodes(
      createWorkflowTemplateDto.nodes,
    );

    const template = await this.workflowTemplateRepository.create({
      name: createWorkflowTemplateDto.name,
      description: createWorkflowTemplateDto.description ?? null,
      scope,
      businessLineId,
      projectId,
      isActive: createWorkflowTemplateDto.isActive ?? true,
      seedOnBusinessLineCreate:
        scope === WorkflowTemplateScope.global
          ? (createWorkflowTemplateDto.seedOnBusinessLineCreate ?? false)
          : false,
      businessLineSeedOrder:
        scope === WorkflowTemplateScope.global
          ? (createWorkflowTemplateDto.businessLineSeedOrder ?? 0)
          : 0,
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

  async findGlobalMastersForBusinessLine(
    query: FindGlobalMastersForBusinessLineDto,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate[]> {
    const businessLineId = query.businessLineId;
    await this.ensureCanManageBusinessLineTemplates(
      businessLineId,
      currentUser,
    );

    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    return this.workflowTemplateRepository.findAllWithPagination({
      paginationOptions,
      keyword: query.keyword,
      isActive: query.isActive ?? true,
      scope: WorkflowTemplateScope.global,
      excludeGlobal: false,
    });
  }

  async copyGlobalTemplateToBusinessLine(
    globalTemplateId: string,
    businessLineId: string,
    currentUser: JwtPayloadType,
  ): Promise<WorkflowTemplate> {
    await this.ensureCanManageBusinessLineTemplates(
      businessLineId,
      currentUser,
    );

    const source =
      await this.workflowTemplateRepository.findById(globalTemplateId);
    if (!source) {
      throw new NotFoundException('Workflow template not found');
    }
    if (source.scope !== WorkflowTemplateScope.global) {
      throw new BadRequestException(
        'Source must be a global workflow template',
      );
    }
    if (!source.isActive) {
      throw new BadRequestException('Global workflow template is not active');
    }

    const existedTemplate = await this.workflowTemplateRepository.findByName(
      source.name,
      {
        scope: WorkflowTemplateScope.businessLine,
        businessLineId,
      },
    );
    if (existedTemplate) {
      throw new ConflictException('Workflow template name already exists');
    }

    const template = await this.workflowTemplateRepository.create({
      name: source.name,
      description: source.description ?? null,
      scope: WorkflowTemplateScope.businessLine,
      businessLineId,
      projectId: null,
      isActive: true,
      seedOnBusinessLineCreate: false,
      businessLineSeedOrder: 0,
      nodesJson: source.nodesJson,
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

    if (scope === WorkflowTemplateScope.global) {
      if (!this.isAdmin(currentUser)) {
        throw new ForbiddenException('forbiddenWorkflowTemplate');
      }
      if (query.businessLineId || query.projectId) {
        throw new BadRequestException(
          'businessLineId and projectId must not be set when scope is global',
        );
      }
      return this.workflowTemplateRepository.findAllWithPagination({
        paginationOptions,
        keyword: query.keyword,
        isActive: query.isActive,
        scope: WorkflowTemplateScope.global,
        excludeGlobal: false,
      });
    }

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
            : existedTemplate.scope === WorkflowTemplateScope.project
              ? {
                  scope: existedTemplate.scope,
                  projectId: existedTemplate.projectId ?? null,
                }
              : {
                  scope: WorkflowTemplateScope.global,
                },
        );

      if (duplicatedTemplate) {
        throw new ConflictException('Workflow template name already exists');
      }
    }

    if (updateWorkflowTemplateDto.nodes) {
      ensureValidWorkflowTemplateNodes(updateWorkflowTemplateDto.nodes);
    }

    if (
      (updateWorkflowTemplateDto.seedOnBusinessLineCreate !== undefined ||
        updateWorkflowTemplateDto.businessLineSeedOrder !== undefined) &&
      existedTemplate.scope !== WorkflowTemplateScope.global
    ) {
      throw new BadRequestException(
        'seedOnBusinessLineCreate and businessLineSeedOrder apply only to global templates',
      );
    }

    const updatedTemplate = await this.workflowTemplateRepository.update(id, {
      ...(updateWorkflowTemplateDto.name !== undefined
        ? { name: updateWorkflowTemplateDto.name }
        : {}),
      ...(updateWorkflowTemplateDto.description !== undefined
        ? { description: updateWorkflowTemplateDto.description }
        : {}),
      ...(updateWorkflowTemplateDto.nodes !== undefined
        ? {
            nodesJson: normalizeWorkflowTemplateNodes(
              updateWorkflowTemplateDto.nodes,
            ),
          }
        : {}),
      ...(updateWorkflowTemplateDto.isActive !== undefined
        ? { isActive: updateWorkflowTemplateDto.isActive }
        : {}),
      ...(updateWorkflowTemplateDto.seedOnBusinessLineCreate !== undefined
        ? {
            seedOnBusinessLineCreate:
              updateWorkflowTemplateDto.seedOnBusinessLineCreate,
          }
        : {}),
      ...(updateWorkflowTemplateDto.businessLineSeedOrder !== undefined
        ? {
            businessLineSeedOrder:
              updateWorkflowTemplateDto.businessLineSeedOrder,
          }
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
    ensureValidWorkflowTemplateNodes(reorderDto.nodes);

    const updatedTemplate = await this.workflowTemplateRepository.update(
      template.id,
      {
        nodesJson: normalizeWorkflowTemplateNodes(reorderDto.nodes),
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
      if (!this.isAdmin(currentUser)) {
        throw new ForbiddenException('forbiddenWorkflowTemplate');
      }
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
      if (!this.isAdmin(currentUser)) {
        throw new ForbiddenException('forbiddenWorkflowTemplate');
      }
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
