/**
 * 合同模板查询参数
 */
export interface ContractTemplateQueryParams {
    /** 模板名称 */
    templateName?: string;
    /** 模版类型：1：单日营；2：多日营 */
    templateType?: number;
    /** 当前页码 */
    page: number;
    /** 每页条数 */
    pageSize: number;
}

/**
 * 合同模板项
 */
export interface ContractTemplateItem {
    /** 模板ID */
    id: string;
    /** 模板名称 */
    templateName: string;
    /** 模板URL */
    templateUrl: string;
    /** 状态：0-禁用，1-启用 */
    status: number;
    /** 模版类型：1：单日营；2：多日营 */
    templateType: number;
    /** 创建人 */
    creator?: string;
    /** 创建时间 */
    createAt: string;
    /** 更新时间 */
    updatedAt: string;
}

/**
 * 合同模板查询返回数据
 */
export interface ContractTemplateListResponse {
    /** 模板列表 */
    list: ContractTemplateItem[];
    /** 总数 */
    total: number;
}

/**
 * 创建合同模板参数
 */
export interface CreateContractTemplateParams {
    /** 模板名称 */
    templateName: string;
    /** 状态：0-禁用，1-启用 */
    status?: number;
    /** 模版类型：1：单日营；2：多日营 */
    templateType: number;
    /** 模板文件 */
    templateUrl: string;
}

/**
 * 更新合同模板参数
 */
export interface UpdateContractTemplateParams {
    /** 模板ID */
    id: string;
    /** 模板名称 */
    templateName: string;
    /** 状态：0-禁用，1-启用 */
    status?: number;
    /** 模版类型：1：单日营；2：多日营 */
    templateType: number;
    templateUrl: string;
}

/**
 * 切换合同模板状态参数
 */
export interface ToggleContractTemplateStatusParams {
    /** 模板ID */
    id: string;
    /** 状态：0-禁用，1-启用 */
    status: number;
}

/**
 * 删除合同模板参数
 */
export interface DeleteContractTemplateParams {
    /** 模板ID */
    id: string;
}

/**
 * 模版类型
 */
export enum TemplateType {
    SINGLE = 1,
    MULTIPLE = 2,
}

/**
 * 模版类型选项
 */
export const TEMPLATE_TYPE_OPTIONS = [
    { label: '单日营', value: TemplateType.SINGLE },
    { label: '多日营', value: TemplateType.MULTIPLE },
]