/**
 * Role Action Controller
 * Handles role and action metadata-related HTTP requests
 * 
 * Uses RoleActionFactory for dynamic role/action instantiation
 */

import { Request, Response } from 'express';
import { Context } from '../../core/context/Context';
import { logger } from '../../utils';
import { RoleActionService } from '../../services/RoleActionService';
import { RoleDefinitionRepository } from '../../database/repositories/RoleDefinitionRepository';
import { ActionDefinitionRepository } from '../../database/repositories/ActionDefinitionRepository';
import { RoleActionFactory } from '../../services/RoleActionFactory';

export class RoleActionController {
    private static roleActionService = new RoleActionService();
    private static roleDefRepo = new RoleDefinitionRepository();
    private static actionDefRepo = new ActionDefinitionRepository();

    /**
     * Get display name for action from database or fallback
     */
    private static async getActionDisplayName(actionName: string): Promise<string> {
        try {
            const actionDef = await RoleActionController.actionDefRepo.findByName(actionName);
            return actionDef?.display_name || actionName;
        } catch {
            return actionName;
        }
    }

    /**
     * Get display name for role from database or fallback
     */
    private static async getRoleDisplayName(profile: string): Promise<string> {
        try {
            const roleDef = await RoleActionController.roleDefRepo.findByProfile(profile);
            return roleDef?.display_name || profile;
        } catch {
            return profile;
        }
    }

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
                if (rolesMetadata.length > 0) {
                    const context = new Context();
                    const roleInstances = RoleActionFactory.createAllRoleInstances(context);
                    const roleInstanceMap = new Map(roleInstances.map(r => [r.profile, r]));

                    // Get action definitions for display names
                    const actionDefs = await RoleActionController.actionDefRepo.findActive();
                    const actionDisplayNames = new Map(actionDefs.map(a => [a.name, a.display_name || a.name]));

                    const enrichedRoles = rolesMetadata.map((roleMeta) => {
                        const roleInstance = roleInstanceMap.get(roleMeta.profile);
                        if (roleInstance) {
                            return {
                                ...roleMeta,
                                actions: roleInstance.actions.map((action) => ({
                                    name: action.name,
                                    description: action.description,
                                    displayName: actionDisplayNames.get(action.name) || action.name,
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

            // Fallback to code-based approach using factory
            const context = new Context();
            const roles = RoleActionFactory.createAllRoleInstances(context);

            // Try to get display names from database
            let roleDefs: any[] = [];
            let actionDefs: any[] = [];
            try {
                roleDefs = await RoleActionController.roleDefRepo.findActive();
                actionDefs = await RoleActionController.actionDefRepo.findActive();
            } catch {
                // Ignore errors
            }
            const roleDisplayNames = new Map(roleDefs.map(r => [r.profile, r.display_name || r.profile]));
            const actionDisplayNames = new Map(actionDefs.map(a => [a.name, a.display_name || a.name]));

            const rolesMetadata = roles.map((role) => ({
                profile: role.profile,
                name: role.name,
                displayName: roleDisplayNames.get(role.profile) || role.profile,
                goal: role.goal,
                constraints: role.constraints,
                description: role.description,
                actions: role.actions.map((action) => ({
                    name: action.name,
                    description: action.description,
                    displayName: actionDisplayNames.get(action.name) || action.name,
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

            // Fallback to code-based approach using factory
            const actionInstances = RoleActionFactory.createAllActionInstances();
            
            // Try to get display names from database
            let actionDefs: any[] = [];
            try {
                actionDefs = await RoleActionController.actionDefRepo.findActive();
            } catch {
                // Ignore errors
            }
            const actionDisplayNames = new Map(actionDefs.map(a => [a.name, a.display_name || a.name]));

            const actionsMetadata = actionInstances.map(action => ({
                name: action.name,
                description: action.description,
                displayName: actionDisplayNames.get(action.name) || action.name,
            }));

            // Also collect actions from roles to ensure completeness
            const context = new Context();
            const roles = RoleActionFactory.createAllRoleInstances(context);
            const roleActionsMap = new Map<string, { name: string; description: string; displayName: string }>();

            roles.forEach((role) => {
                role.actions.forEach((action) => {
                    if (action.name && action.description && !roleActionsMap.has(action.name)) {
                        roleActionsMap.set(action.name, {
                            name: action.name,
                            description: action.description,
                            displayName: actionDisplayNames.get(action.name) || action.name,
                        });
                    }
                });
            });

            // Merge role actions with action instances
            roleActionsMap.forEach((actionMeta, name) => {
                const existing = actionsMetadata.find((a) => a.name === name);
                if (!existing) {
                    actionsMetadata.push(actionMeta);
                }
            });

            actionsMetadata.sort((a, b) => a.name.localeCompare(b.name));

            return res.json({
                success: true,
                actions: actionsMetadata,
                total: actionsMetadata.length,
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
                    const roleInstances = RoleActionFactory.createAllRoleInstances(context);
                    const roleInstanceMap = new Map(roleInstances.map(r => [r.profile, r]));
                    
                    // Get full definitions from database
                    const roleDefs = await RoleActionController.roleDefRepo.findActive();
                    const actionDefs = await RoleActionController.actionDefRepo.findActive();
                    const actionDisplayNames = new Map(actionDefs.map(a => [a.name, a.display_name || a.name]));
                    
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
                                displayName: actionDisplayNames.get(action.name) || action.name,
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

            // Fallback to code-based approach using factory
            const context = new Context();
            const roles = RoleActionFactory.createAllRoleInstances(context);

            // Try to get metadata from database even in fallback mode
            let roleDefs: any[] = [];
            let actionDefs: any[] = [];
            try {
                roleDefs = await RoleActionController.roleDefRepo.findActive();
                actionDefs = await RoleActionController.actionDefRepo.findActive();
            } catch {
                // Ignore errors
            }
            const roleDisplayNames = new Map(roleDefs.map(r => [r.profile, r.display_name || r.profile]));
            const actionDisplayNames = new Map(actionDefs.map(a => [a.name, a.display_name || a.name]));

            const rolesMetadata = roles.map((role) => {
                const roleDef = roleDefs.find(r => r.profile === role.profile);
                return {
                    profile: role.profile,
                    name: role.name,
                    displayName: roleDisplayNames.get(role.profile) || role.profile,
                    goal: role.goal,
                    constraints: role.constraints,
                    description: role.description,
                    inputSchema: roleDef?.metadata?.input_schema,
                    outputSchema: roleDef?.metadata?.output_schema,
                    defaultActions: roleDef?.metadata?.default_actions || [],
                    actions: role.actions.map((action) => ({
                        name: action.name,
                        description: action.description,
                        displayName: actionDisplayNames.get(action.name) || action.name,
                    })),
                };
            });

            // Get actions from factory
            const actionInstances = RoleActionFactory.createAllActionInstances();
            const actionsMetadata: any[] = [];
            const roleActionsMap = new Map<string, any>();

            // Collect from roles
            roles.forEach((role) => {
                role.actions.forEach((action) => {
                    if (action.name && action.description && !roleActionsMap.has(action.name)) {
                        roleActionsMap.set(action.name, {
                            name: action.name,
                            description: action.description,
                            displayName: actionDisplayNames.get(action.name) || action.name,
                        });
                    }
                });
            });

            // Collect from action instances
            actionInstances.forEach((action) => {
                if (action.name && action.description && !roleActionsMap.has(action.name)) {
                    roleActionsMap.set(action.name, {
                        name: action.name,
                        description: action.description,
                        displayName: actionDisplayNames.get(action.name) || action.name,
                    });
                }
            });

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

            // Check if role class exists in registry
            if (!RoleActionFactory.hasRoleProfile(profile)) {
                return res.status(400).json({
                    success: false,
                    error: 'Role class not found',
                    message: `Role class '${profile}' is not registered. Available: ${RoleActionFactory.getAvailableRoleProfiles().join(', ')}`,
                });
            }

            // Check if role already exists in database
            const existing = await RoleActionController.roleDefRepo.findByProfile(profile);
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Role already exists',
                    message: `Role with profile '${profile}' already exists`,
                });
            }

            // Validate schemas if provided
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
                const invalidActions = default_actions.filter(a => !RoleActionFactory.hasActionName(a));
                if (invalidActions.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid default_actions',
                        message: `Actions not found in registry: ${invalidActions.join(', ')}`,
                    });
                }
            }

            // Build metadata
            const metadata: Record<string, any> = {};
            if (input_schema) metadata.input_schema = input_schema;
            if (output_schema) metadata.output_schema = output_schema;
            if (default_actions && Array.isArray(default_actions)) metadata.default_actions = default_actions;

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

            // Check if action class exists in registry
            if (!RoleActionFactory.hasActionName(name)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action class not found',
                    message: `Action class '${name}' is not registered. Available: ${RoleActionFactory.getAvailableActionNames().join(', ')}`,
                });
            }

            // Check if action already exists in database
            const existing = await RoleActionController.actionDefRepo.findByName(name);
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Action already exists',
                    message: `Action with name '${name}' already exists`,
                });
            }

            // Validate schemas if provided
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
                const invalidRoles = compatible_roles.filter(r => !RoleActionFactory.hasRoleProfile(r));
                if (invalidRoles.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid compatible_roles',
                        message: `Roles not found in registry: ${invalidRoles.join(', ')}`,
                    });
                }
            }

            // Build metadata
            const metadata: Record<string, any> = {};
            if (input_schema) metadata.input_schema = input_schema;
            if (output_schema) metadata.output_schema = output_schema;
            if (compatible_roles && Array.isArray(compatible_roles)) metadata.compatible_roles = compatible_roles;

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
