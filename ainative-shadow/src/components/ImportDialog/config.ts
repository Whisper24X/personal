import type { ImportConfig } from './types'

// 导入配置
export const IMPORT_CONFIGS: Record<string, ImportConfig> = {
  // 合同记录导入配置
  contract: {
    title: '导入用户信息',
    templateUrl:
      'https://fp.yangcong345.com/middle/1.0.0/contractTemplate.xlsx',
    filePath: 'contract/csv',
    importApi: '/api/shadow/v1/importContractUserInfoByCsvFile',
    successMessage: '导入成功',
    errorMessage: '导入失败',
    templateFileName: '合同记录导入模板.xlsx',
  },
}
