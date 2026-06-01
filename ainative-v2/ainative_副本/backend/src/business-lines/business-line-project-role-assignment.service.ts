import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';
import { ProjectMemberRepository } from '../projects/infrastructure/persistence/project-member.repository';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { BusinessLineInviteProjectRole } from './dto/business-line-invite-project-role.enum';
import { BusinessLineRoleCatalogService } from './business-line-role-catalog.service';

@Injectable()
export class BusinessLineProjectRoleAssignmentService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly businessLineRoleCatalogService: BusinessLineRoleCatalogService,
  ) {}

  normalizeExplicitProjectRoles(
    rawProjectRoles?: Record<string, string>,
  ): Record<string, string> {
    if (!rawProjectRoles) {
      return {};
    }

    if (Array.isArray(rawProjectRoles)) {
      throw new BadRequestException('Invalid project role payload');
    }

    const nextProjectRoles: Record<string, string> = {};

    for (const [projectId, roleId] of Object.entries(rawProjectRoles)) {
      if (!this.isUuid(projectId)) {
        throw new BadRequestException('Invalid project id in member payload');
      }

      if (typeof roleId !== 'string') {
        throw new BadRequestException('Invalid project role in member payload');
      }

      const normalizedRoleId = roleId.trim();
      if (normalizedRoleId !== 'none' && !this.isUuid(normalizedRoleId)) {
        throw new BadRequestException('Invalid project role in member payload');
      }

      nextProjectRoles[projectId] = normalizedRoleId || 'none';
    }

    return nextProjectRoles;
  }

  normalizeInviteProjectRoles(
    rawProjectRoles?: Record<string, BusinessLineInviteProjectRole>,
  ): Record<string, BusinessLineInviteProjectRole> {
    if (!rawProjectRoles) {
      return {};
    }

    if (Array.isArray(rawProjectRoles)) {
      throw new BadRequestException('Invalid project role payload');
    }

    const nextProjectRoles: Record<string, BusinessLineInviteProjectRole> = {};

    for (const [projectId, role] of Object.entries(rawProjectRoles)) {
      if (!this.isUuid(projectId)) {
        throw new BadRequestException('Invalid project id in invite payload');
      }

      if (!Object.values(BusinessLineInviteProjectRole).includes(role)) {
        throw new BadRequestException('Invalid project role in invite payload');
      }

      nextProjectRoles[projectId] = role;
    }

    return nextProjectRoles;
  }

  async syncExplicitProjectRoleAssignments({
    businessLineId,
    userId,
    projectRoles,
  }: {
    businessLineId: string;
    userId: string;
    projectRoles: Record<string, string>;
  }): Promise<string[]> {
    const failedProjects: string[] = [];

    for (const [projectId, roleId] of Object.entries(projectRoles)) {
      try {
        const project = await this.projectRepository.findById(projectId);
        if (!project || project.businessLineId !== businessLineId) {
          failedProjects.push(projectId);
          continue;
        }

        const existedMember =
          await this.projectMemberRepository.findByProjectIdAndUserId(
            projectId,
            userId,
          );

        if (roleId === 'none') {
          if (!existedMember) {
            continue;
          }

          if (
            await this.businessLineRoleCatalogService.isProjectOwnerRole(
              businessLineId,
              existedMember.roleId,
            )
          ) {
            continue;
          }

          await this.projectMemberRepository.remove(projectId, userId);
          continue;
        }

        const nextProjectRole =
          await this.businessLineRoleCatalogService.getBusinessLineProjectCustomRoleOrThrow(
            businessLineId,
            roleId,
          );

        if (!existedMember) {
          await this.projectMemberRepository.create({
            projectId,
            userId,
            roleId: nextProjectRole.id,
          });
          continue;
        }

        if (
          await this.businessLineRoleCatalogService.isProjectOwnerRole(
            businessLineId,
            existedMember.roleId,
          )
        ) {
          continue;
        }

        if (existedMember.roleId !== nextProjectRole.id) {
          await this.projectMemberRepository.update(projectId, userId, {
            roleId: nextProjectRole.id,
          });
        }
      } catch (error) {
        void error;
        failedProjects.push(projectId);
      }
    }

    return failedProjects;
  }

  async syncProjectRoleAssignments({
    businessLineId,
    userId,
    projectRoles,
  }: {
    businessLineId: string;
    userId: string;
    projectRoles: Record<string, BusinessLineInviteProjectRole>;
  }): Promise<string[]> {
    const failedProjects: string[] = [];

    for (const [projectId, role] of Object.entries(projectRoles)) {
      try {
        const project = await this.projectRepository.findById(projectId);
        if (!project || project.businessLineId !== businessLineId) {
          failedProjects.push(projectId);
          continue;
        }

        const existedMember =
          await this.projectMemberRepository.findByProjectIdAndUserId(
            projectId,
            userId,
          );

        if (role === BusinessLineInviteProjectRole.none) {
          if (!existedMember) {
            continue;
          }

          if (
            await this.businessLineRoleCatalogService.isProjectOwnerRole(
              businessLineId,
              existedMember.roleId,
            )
          ) {
            continue;
          }

          await this.projectMemberRepository.remove(projectId, userId);
          continue;
        }

        const nextRole = this.mapInviteProjectRoleToProjectRole(role);
        if (!nextRole) {
          continue;
        }

        if (!existedMember) {
          const nextProjectRole =
            await this.businessLineRoleCatalogService.findDefaultProjectCustomRole(
              businessLineId,
              nextRole,
            );

          await this.projectMemberRepository.create({
            projectId,
            userId,
            roleId: nextProjectRole.id,
          });
          continue;
        }

        if (
          await this.businessLineRoleCatalogService.isProjectOwnerRole(
            businessLineId,
            existedMember.roleId,
          )
        ) {
          continue;
        }

        const nextProjectRole =
          await this.businessLineRoleCatalogService.findDefaultProjectCustomRole(
            businessLineId,
            nextRole,
          );

        if (existedMember.roleId !== nextProjectRole.id) {
          await this.projectMemberRepository.update(projectId, userId, {
            roleId: nextProjectRole.id,
          });
        }
      } catch (error) {
        void error;
        failedProjects.push(projectId);
      }
    }

    return failedProjects;
  }

  private mapInviteProjectRoleToProjectRole(
    role: BusinessLineInviteProjectRole,
  ): ProjectMemberRole | null {
    if (role === BusinessLineInviteProjectRole.none) {
      return null;
    }

    if (role === BusinessLineInviteProjectRole.manage) {
      return ProjectMemberRole.maintainer;
    }

    if (role === BusinessLineInviteProjectRole.developer) {
      return ProjectMemberRole.developer;
    }

    return ProjectMemberRole.viewer;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
