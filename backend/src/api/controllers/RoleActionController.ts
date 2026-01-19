/**
 * Role Action Controller
 * Handles role and action metadata-related HTTP requests
 */

import { Request, Response } from 'express';
import { Context } from '../../core/context/Context';
import { logger } from '../../utils';
import { RoleActionService } from '../../services/RoleActionService';
import { RoleDefinitionRepository } from '../../database/repositories/RoleDefinitionRepository';
import { ActionDefinitionRepository } from '../../database/repositories/ActionDefinitionRepository';
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
    private static roleDefRepo = new RoleDefinitionRepository();
    private static actionDefRepo = new ActionDefinitionRepository();

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
                    
                    // Get full role definitions from database to extract metadata
                    const roleDefs = await RoleActionController.roleDefRepo.findActive();
                    const actionDefs = await RoleActionController.actionDefRepo.findActive();
                    
                    const enrichedRoles = roles.map((roleMeta) => {
                        const roleDef = roleDefs.find(r => r.profile === roleMeta.profile);
                        const roleInstance = roleInstanceMap.get(roleMeta.profile);
                        
                        const enrichedRole: any = {
                            ...roleMeta,
                            inputSchema: roleDef?.metadata?.input_schema,
                            outputSchema: roleDef?.metadata?.output_schema,
                            defaultActions: roleDef?.metadata?.default_actions || [],
                        };
                        
                        if (roleInstance) {
                            enrichedRole.actions = roleInstance.actions.map((action) => ({
                                name: action.name,
                                description: action.description,
                                displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                            }));
                        }
                        
                        return enrichedRole;
                    });
                    
                    const enrichedActions = actions.map((actionMeta) => {
                        const actionDef = actionDefs.find(a => a.name === actionMeta.name);
                        return {
                            ...actionMeta,
                            inputSchema: actionDef?.metadata?.input_schema,
                            outputSchema: actionDef?.metadata?.output_schema,
                            compatibleRoles: actionDef?.metadata?.compatible_roles || [],
                        };
                    });

                    return res.json({
                        success: true,
                        roles: enrichedRoles,
                        actions: enrichedActions,
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

            // Try to get metadata from database even in fallback mode
            let roleDefs: any[] = [];
            let actionDefs: any[] = [];
            try {
                roleDefs = await RoleActionController.roleDefRepo.findActive();
                actionDefs = await RoleActionController.actionDefRepo.findActive();
            } catch (e) {
                // Ignore errors, use empty arrays
            }

            const rolesMetadata = roles.map((role) => {
                const roleDef = roleDefs.find(r => r.profile === role.profile);
                return {
                    profile: role.profile,
                    name: role.name,
                    displayName: ROLE_DISPLAY_NAMES[role.profile] || role.profile,
                    goal: role.goal,
                    constraints: role.constraints,
                    description: role.description,
                    inputSchema: roleDef?.metadata?.input_schema,
                    outputSchema: roleDef?.metadata?.output_schema,
                    defaultActions: roleDef?.metadata?.default_actions || [],
                    actions: role.actions.map((action) => ({
                        name: action.name,
                        description: action.description,
                        displayName: ACTION_DISPLAY_NAMES[action.name] || action.name,
                    })),
                };
            });

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

            roleActionsMap.forEach((meta) => {
                const actionDef = actionDefs.find(a => a.name === meta.name);
                actionsMetadata.push({
                    ...meta,
                    inputSchema: actionDef?.metadata?.input_schema,
                    outputSchema: actionDef?.metadata?.output_schema,
                    compatibleRoles: actionDef?.metadata?.compatible_roles || [],
                });
            });
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

    /**
     * Create a new role definition
     * POST /api/config/roles
     */
    static async createRole(req: Request, res: Response) {
        try {
            const {
                profile,
                name,
                display_name,
                goal,
                constraints,
                description,
                class_name,
                is_active,
                input_schema,
                output_schema,
                default_actions,
            } = req.body;

            // Validate required fields
            if (!profile || !name || !class_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    message: 'profile, name, and class_name are required',
                });
            }

            // Check if role already exists
            const existing = await RoleActionController.roleDefRepo.findByProfile(profile);
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Role already exists',
                    message: `Role with profile '${profile}' already exists`,
                });
            }

            // Validate input_schema and output_schema if provided
            if (input_schema && typeof input_schema !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid input_schema',
                    message: 'input_schema must be a valid JSON Schema object',
                });
            }

            if (output_schema && typeof output_schema !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid output_schema',
                    message: 'output_schema must be a valid JSON Schema object',
                });
            }

            // Validate default_actions if provided
            if (default_actions && Array.isArray(default_actions) && default_actions.length > 0) {
                const actionDefs = await RoleActionController.actionDefRepo.findByNames(default_actions);
                const validActions = new Set(actionDefs.map((a) => a.name));
                const invalidActions = default_actions.filter((a) => !validActions.has(a));
                if (invalidActions.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid default_actions',
                        message: `Actions not found: ${invalidActions.join(', ')}`,
                    });
                }
            }

            // Build metadata
            const metadata: Record<string, any> = {};
            if (input_schema) {
                metadata.input_schema = input_schema;
            }
            if (output_schema) {
                metadata.output_schema = output_schema;
            }
            if (default_actions && Array.isArray(default_actions)) {
                metadata.default_actions = default_actions;
            }

            // Create role definition
            const role = await RoleActionController.roleDefRepo.create({
                profile,
                name,
                display_name,
                goal,
                constraints,
                description,
                class_name,
                is_active: is_active !== undefined ? is_active : true,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            });

            logger.info(`RoleActionController: Created role definition: ${profile}`);

            return res.status(201).json({
                success: true,
                role: {
                    profile: role.profile,
                    name: role.name,
                    displayName: role.display_name,
                    goal: role.goal,
                    constraints: role.constraints,
                    description: role.description,
                    className: role.class_name,
                    isActive: role.is_active,
                    inputSchema: role.metadata?.input_schema,
                    outputSchema: role.metadata?.output_schema,
                    defaultActions: role.metadata?.default_actions || [],
                },
            });
        } catch (error: any) {
            logger.error('RoleActionController: Failed to create role:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to create role',
                message: error.message,
            });
        }
    }

    /**
     * Create a new action definition
     * POST /api/config/actions
     */
    static async createAction(req: Request, res: Response) {
        try {
            const {
                name,
                display_name,
                description,
                class_name,
                category,
                is_active,
                input_schema,
                output_schema,
                compatible_roles,
            } = req.body;

            // Validate required fields
            if (!name || !class_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    message: 'name and class_name are required',
                });
            }

            // Check if action already exists
            const existing = await RoleActionController.actionDefRepo.findByName(name);
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Action already exists',
                    message: `Action with name '${name}' already exists`,
                });
            }

            // Validate input_schema and output_schema if provided
            if (input_schema && typeof input_schema !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid input_schema',
                    message: 'input_schema must be a valid JSON Schema object',
                });
            }

            if (output_schema && typeof output_schema !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid output_schema',
                    message: 'output_schema must be a valid JSON Schema object',
                });
            }

            // Validate compatible_roles if provided
            if (compatible_roles && Array.isArray(compatible_roles) && compatible_roles.length > 0) {
                const roleDefs = await RoleActionController.roleDefRepo.findByProfiles(compatible_roles);
                const validRoles = new Set(roleDefs.map((r) => r.profile));
                const invalidRoles = compatible_roles.filter((r) => !validRoles.has(r));
                if (invalidRoles.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid compatible_roles',
                        message: `Roles not found: ${invalidRoles.join(', ')}`,
                    });
                }
            }

            // Build metadata
            const metadata: Record<string, any> = {};
            if (input_schema) {
                metadata.input_schema = input_schema;
            }
            if (output_schema) {
                metadata.output_schema = output_schema;
            }
            if (compatible_roles && Array.isArray(compatible_roles)) {
                metadata.compatible_roles = compatible_roles;
            }

            // Create action definition
            const action = await RoleActionController.actionDefRepo.create({
                name,
                display_name,
                description,
                class_name,
                category,
                is_active: is_active !== undefined ? is_active : true,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            });

            logger.info(`RoleActionController: Created action definition: ${name}`);

            return res.status(201).json({
                success: true,
                action: {
                    name: action.name,
                    displayName: action.display_name,
                    description: action.description,
                    className: action.class_name,
                    category: action.category,
                    isActive: action.is_active,
                    inputSchema: action.metadata?.input_schema,
                    outputSchema: action.metadata?.output_schema,
                    compatibleRoles: action.metadata?.compatible_roles || [],
                },
            });
        } catch (error: any) {
            logger.error('RoleActionController: Failed to create action:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to create action',
                message: error.message,
            });
        }
    }
}

