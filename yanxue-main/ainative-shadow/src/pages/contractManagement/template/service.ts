import http from '@/service/axios.interceptor';
import {
    ContractTemplateQueryParams,
    ContractTemplateListResponse,
    CreateContractTemplateParams,
    UpdateContractTemplateParams,
    ToggleContractTemplateStatusParams,
    DeleteContractTemplateParams,
    CampPeriod
} from './service.type';

/**
 * 查询合同模板列表
 * @param params 查询参数
 * @returns 返回合同模板列表和总数
 */
export function queryContractTemplateList(params: ContractTemplateQueryParams): Promise<ContractTemplateListResponse> {
    try {
        // 创建一个简单的查询参数对象，避免传递可能包含复杂引用的对象
        const queryParams = {
            page: params.page,
            pageSize: params.pageSize,
            templateName: params.templateName || ''
        };
        return http.post('/api/shadow/v1/queryContractTemplateList', queryParams);
    } catch (error) {
        console.error('查询合同模板列表请求构建错误:', error);
        return Promise.reject(error);
    }
}

/**
 * 创建合同模板
 * @param data 模板数据
 * @returns 返回创建结果
 */
export function createContractTemplate(data: FormData): Promise<any> {
    return http.post('/api/shadow/v1/storeContractTemplate', data);
}

/**
 * 更新合同模板
 * @param data 模板数据
 * @returns 返回更新结果
 */
export function updateContractTemplate(data: FormData): Promise<any> {
    return http.post('/api/shadow/v1/storeContractTemplate', data);
}

/**
 * 删除合同模板
 * @param id 模板ID
 * @returns 返回删除结果
 */
export function deleteContractTemplate(id: string): Promise<any> {
    return http.post('/api/shadow/v1/deleteContractTemplate', { id });
}

/**
 * 更新合同模板状态
 * @param data 包含id和状态的对象
 * @returns 返回操作结果
 */
export function updateContractTemplateStatus(data: ToggleContractTemplateStatusParams): Promise<any> {
    return http.post('/api/shadow/v1/updateContractTemplateStatus', data);
}

/**
 * 下载合同模板
 * @param url 模板URL
 * @returns 返回下载的文件内容
 */
export function downloadContractTemplate(url: string): Promise<Blob> {
    return http.get(url, {
        responseType: 'blob',
        baseURL: '' // 使用完整URL
    });
}
