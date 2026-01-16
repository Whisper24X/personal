/**
 * Role Action Controller
 * Handles role and action metadata-related HTTP requests
 */

import { Request, Response } from 'express';
import { Context } from '../../core/context/Context';
import { logger } from '../../utils';
import { RoleActionService } from '../../services/RoleActionService';
import {
    Salesperson,
    ProductManager,
    Architect,
    ProjectManager,
    Engineer,
    QAEngineer,
    TeamLeader,
    DataAnalyst,
} from '../../roles';
import {
    WriteMRD,
    WritePRD,
    WriteDesign,
    WriteSubProjectDesign,
    WriteCode,
    WriteTest,
    MRDReview,
    PRDReview,
    DesignReview,
    SubProjectDesignReview,
    CodeReview,
    ImprovePRD,
    ImproveMRD,
    BreakdownTasks,
    ExecuteSubtask,
    RunCode,
    FixBug,
    SearchEnhancedQA,
    DataAnalysis,
    Coordinate,
} from '../../actions';

/**
 * Action display names mapping (Chinese)
 */
const ACTION_DISPLAY_NAMES: Record<string, string> = {
    // Salesperson actions
    WriteMRD: '编写MRD',
    MRDReview: 'MRD审查',
    ImproveMRD: '改进MRD',

    // ProductManager actions
    WritePRD: '编写PRD',
    PRDReview: 'PRD审查',
    ImprovePRD: '改进PRD',
    SearchEnhancedQA: 'RAG增强',

    // Architect actions
    WriteDesign: '编写设计文档',
    DesignReview: '设计审查',

    // ProjectManager actions
    BreakdownTasks: '任务拆分',
    WriteSubProjectDesign: '子项目设计',
    SubProjectDesignReview: '子项目设计审查',
    CodeReview: '代码审查',

    // Engineer actions
    WriteCode: '编写代码',
    ExecuteSubtask: '执行子任务',
    RunCode: '运行代码',
    FixBug: '修复Bug',

    // QAEngineer actions
    WriteTest: '编写测试',

    // TeamLeader actions
    Coordinate: '协调工作',

    // DataAnalyst actions
    DataAnalysis: '数据分析',
};

/**
 * Role display names mapping (Chinese)
 */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
    Salesperson: '销售',
    ProductManager: '产品经理',
    Architect: '架构师',
    ProjectManager: '项目经理',
    Engineer: '工程师',
    QAEngineer: 'QA工程师',
    TeamLeader: '团队领导',
    DataAnalyst: '数据分析师',
};

export class RoleActionController {
    private static roleActionService = new RoleActionService();

    /**
     * Get all roles metadata
     * GET /api/config/roles
     */
    static async getRoles(_req: Request, res: Response) {
        try {
            // Try to get from database first
            try {
                const rolesMetadata = await RoleActionController.roleActionService.getAllRoles();
                
                // If we have roles from database, enrich with actions from code instances
                // (since role-action associations are in workflow configs, not role definitions)
                if (rolesMetadata.length > 0) {
                    const context = new Context();
                    const roleInstances = [
                        new Salesperson(context),
                        new ProductManager(context),
                        new Architect(context),
                        new ProjectManager(context),
                        new Engineer(context),
                        new QAEngineer(context),
                        new TeamLeader(context),
                        new DataAnalyst(context),
                    ];

                    // Map role instances by profile
                    const roleInstanceMap = new Map(roleInstances.map(r => [r.profile, r]));

                    // Enrich roles with actions from code instances
                    const enrichedRoles = rolesMetadata.map((roleMeta) => {
                        const roleInstance = roleInstanceMap.get(roleMeta.profile);
                        if (roleInstance) {
                            return {
                                ...roleMeta,
                                actions: roleInstance.actions.map((action) => ({
                                    name: action.name,
                                    description: action.description,
                                    displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                                })),
                            };
                        }
                        return roleMeta;
                    });

                    return res.json({
                        success: true,
                        roles: enrichedRoles,
                    });
                }
            } catch (dbError: any) {
                logger.warn('RoleActionController: Failed to get roles from database, falling back to code:', dbError.message);
            }

            // Fallback to code-based approach
            const context = new Context();
            const roles = [
                new Salesperson(context),
                new ProductManager(context),
                new Architect(context),
                new ProjectManager(context),
                new Engineer(context),
                new QAEngineer(context),
                new TeamLeader(context),
                new DataAnalyst(context),
            ];

            const rolesMetadata = roles.map((role) => ({
                profile: role.profile,
                name: role.name,
                displayName: ROLE_DISPLAY_NAMES[role.profile] || role.profile,
                goal: role.goal,
                constraints: role.constraints,
                description: role.description,
                actions: role.actions.map((action) => ({
                    name: action.name,
                    description: action.description,
                    displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                })),
            }));

            return res.json({
                success: true,
                roles: rolesMetadata,
            });
        } catch (error: any) {
            logger.error('RoleActionController: Failed to get roles:', error);
            return res.status(500).json({
                error: 'Failed to get roles',
                message: error.message,
            });
        }
    }

    /**
     * Get all actions metadata
     * GET /api/config/actions
     */
    static async getActions(_req: Request, res: Response) {
        try {
            // Try to get from database first
            try {
                const actionsMetadata = await RoleActionController.roleActionService.getAllActions();
                if (actionsMetadata.length > 0) {
                    return res.json({
                        success: true,
                        actions: actionsMetadata,
                        total: actionsMetadata.length,
                    });
                }
            } catch (dbError: any) {
                logger.warn('RoleActionController: Failed to get actions from database, falling back to code:', dbError.message);
            }

            // Fallback to code-based approach
            const actionClasses = [
                WriteMRD,
                WritePRD,
                WriteDesign,
                WriteSubProjectDesign,
                WriteCode,
                WriteTest,
                MRDReview,
                PRDReview,
                DesignReview,
                SubProjectDesignReview,
                CodeReview,
                ImprovePRD,
                ImproveMRD,
                BreakdownTasks,
                ExecuteSubtask,
                RunCode,
                FixBug,
                SearchEnhancedQA,
                DataAnalysis,
                Coordinate,
            ];

            const actionsMetadata: Array<{ name: string; description: string; displayName: string }> = [];
            const errors: string[] = [];

            for (const ActionClass of actionClasses) {
                try {
                    const action = new ActionClass();
                    if (action.name && action.description) {
                        actionsMetadata.push({
                            name: action.name,
                            description: action.description,
                            displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                        });
                    }
                } catch (error: any) {
                    const errorMsg = `Failed to instantiate ${ActionClass.name}: ${error.message}`;
                    logger.warn('RoleActionController: ' + errorMsg);
                    errors.push(errorMsg);
                }
            }

            // Also collect actions from roles to ensure completeness
            try {
                const context = new Context();
                const roles = [
                    new Salesperson(context),
                    new ProductManager(context),
                    new Architect(context),
                    new ProjectManager(context),
                    new Engineer(context),
                    new QAEngineer(context),
                    new TeamLeader(context),
                    new DataAnalyst(context),
                ];

                const roleActionsMap = new Map<string, { name: string; description: string; displayName: string }>();
                roles.forEach((role) => {
                    role.actions.forEach((action) => {
                        if (action.name && action.description && !roleActionsMap.has(action.name)) {
                            roleActionsMap.set(action.name, {
                                name: action.name,
                                description: action.description,
                                displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                            });
                        }
                    });
                });

                roleActionsMap.forEach((actionMeta, name) => {
                    const existing = actionsMetadata.find((a) => a.name === name);
                    if (!existing) {
                        actionsMetadata.push(actionMeta);
                    }
                });
            } catch (error: any) {
                logger.warn('RoleActionController: Failed to collect actions from roles:', error);
                errors.push(`Failed to collect actions from roles: ${error.message}`);
            }

            actionsMetadata.sort((a, b) => a.name.localeCompare(b.name));

            return res.json({
                success: true,
                actions: actionsMetadata,
                total: actionsMetadata.length,
                ...(errors.length > 0 && { warnings: errors }),
            });
        } catch (error: any) {
            logger.error('RoleActionController: Failed to get actions:', error);
            return res.status(500).json({
                error: 'Failed to get actions',
                message: error.message,
            });
        }
    }

    /**
     * Get roles and actions metadata together
     * GET /api/config/roles-actions
     */
    static async getRolesAndActions(_req: Request, res: Response) {
        try {
            // Try to get from database first
            try {
                const { roles, actions } = await RoleActionController.roleActionService.getRolesAndActions();
                
                // Enrich roles with actions from code instances
                if (roles.length > 0) {
                    const context = new Context();
                    const roleInstances = [
                        new Salesperson(context),
                        new ProductManager(context),
                        new Architect(context),
                        new ProjectManager(context),
                        new Engineer(context),
                        new QAEngineer(context),
                        new TeamLeader(context),
                        new DataAnalyst(context),
                    ];

                    const roleInstanceMap = new Map(roleInstances.map(r => [r.profile, r]));
                    const enrichedRoles = roles.map((roleMeta) => {
                        const roleInstance = roleInstanceMap.get(roleMeta.profile);
                        if (roleInstance) {
                            return {
                                ...roleMeta,
                                actions: roleInstance.actions.map((action) => ({
                                    name: action.name,
                                    description: action.description,
                                    displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                                })),
                            };
                        }
                        return roleMeta;
                    });

                    return res.json({
                        success: true,
                        roles: enrichedRoles,
                        actions: actions,
                    });
                }
            } catch (dbError: any) {
                logger.warn('RoleActionController: Failed to get roles and actions from database, falling back to code:', dbError.message);
            }

            // Fallback to code-based approach
            const context = new Context();
            const roles = [
                new Salesperson(context),
                new ProductManager(context),
                new Architect(context),
                new ProjectManager(context),
                new Engineer(context),
                new QAEngineer(context),
                new TeamLeader(context),
                new DataAnalyst(context),
            ];

            const rolesMetadata = roles.map((role) => ({
                profile: role.profile,
                name: role.name,
                displayName: ROLE_DISPLAY_NAMES[role.profile] || role.profile,
                goal: role.goal,
                constraints: role.constraints,
                description: role.description,
                actions: role.actions.map((action) => ({
                    name: action.name,
                    description: action.description,
                    displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                })),
            }));

            const actionClasses = [
                WriteMRD,
                WritePRD,
                WriteDesign,
                WriteSubProjectDesign,
                WriteCode,
                WriteTest,
                MRDReview,
                PRDReview,
                DesignReview,
                SubProjectDesignReview,
                CodeReview,
                ImprovePRD,
                BreakdownTasks,
                ExecuteSubtask,
                RunCode,
                FixBug,
                SearchEnhancedQA,
                DataAnalysis,
                Coordinate,
            ];

            const actionsMetadata: Array<{ name: string; description: string; displayName: string }> = [];
            const roleActionsMap = new Map<string, { name: string; description: string; displayName: string }>();

            roles.forEach((role) => {
                role.actions.forEach((action) => {
                    if (action.name && action.description && !roleActionsMap.has(action.name)) {
                        roleActionsMap.set(action.name, {
                            name: action.name,
                            description: action.description,
                            displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                        });
                    }
                });
            });

            for (const ActionClass of actionClasses) {
                try {
                    const action = new ActionClass();
                    if (action.name && action.description && !roleActionsMap.has(action.name)) {
                        roleActionsMap.set(action.name, {
                            name: action.name,
                            description: action.description,
                            displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                        });
                    }
                } catch (error: any) {
                    logger.warn(`RoleActionController: Failed to instantiate ${ActionClass.name}:`, error);
                }
            }

            roleActionsMap.forEach((meta) => actionsMetadata.push(meta));
            actionsMetadata.sort((a, b) => a.name.localeCompare(b.name));

            return res.json({
                success: true,
                roles: rolesMetadata,
                actions: actionsMetadata,
            });
        } catch (error: any) {
            logger.error('RoleActionController: Failed to get roles and actions:', error);
            return res.status(500).json({
                error: 'Failed to get roles and actions',
                message: error.message,
            });
        }
    }
}

