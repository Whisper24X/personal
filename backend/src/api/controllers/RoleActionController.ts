/**
 * Role Action Controller
 * Handles role and action metadata-related HTTP requests
 */

import { Request, Response } from 'express';
import { Context } from '../../core/context/Context';
import { logger } from '../../utils';
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
    ImproveDocument,
    ImproveMRD,
    BreakdownTasks,
    GenerateTask,
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
    ImproveDocument: '改进文档',
    SearchEnhancedQA: 'RAG增强',

    // Architect actions
    WriteDesign: '编写设计文档',
    DesignReview: '设计审查',

    // ProjectManager actions
    BreakdownTasks: '任务拆分',
    WriteSubProjectDesign: '子项目设计',
    GenerateTask: '生成任务说明',
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
    /**
     * Get all roles metadata
     * GET /api/config/roles
     */
    static async getRoles(_req: Request, res: Response) {
        try {
            // Create a temporary context for instantiating roles
            const context = new Context();

            // Instantiate all roles to get their metadata
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

            // Extract role metadata
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
            // Actions don't require context for metadata extraction
            // Use action classes array to ensure all actions are included
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
                ImproveDocument,
                ImproveMRD,
                BreakdownTasks,
                GenerateTask,
                ExecuteSubtask,
                RunCode,
                FixBug,
                SearchEnhancedQA,
                DataAnalysis,
                Coordinate,
            ];

            // Instantiate all actions and collect metadata, handling errors gracefully
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

                // Collect unique actions from roles
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

                // Merge role actions with direct instantiated actions
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

            // Sort actions by name for consistent output
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
            // Create a temporary context for instantiating roles and actions
            // Note: context is used implicitly when instantiating roles
            const context = new Context();

            // Get roles
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

            // Get actions - use the same method as getActions to ensure consistency
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
                ImproveDocument,
                BreakdownTasks,
                GenerateTask,
                ExecuteSubtask,
                RunCode,
                FixBug,
                SearchEnhancedQA,
                DataAnalysis,
                Coordinate,
            ];

            // Collect actions from direct instantiation
            const actionsMetadata: Array<{ name: string; description: string; displayName: string }> = [];
            const roleActionsMap = new Map<string, { name: string; description: string; displayName: string }>();

            // First, collect from roles to get actual used actions
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

            // Then, instantiate all action classes to ensure completeness
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

            // Convert map to array and sort
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

