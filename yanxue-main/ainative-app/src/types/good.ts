/**
 * 商品类型
 */
export type GoodType = 'single' | 'multi' | 'deposit'

/**
 * 商品类型映射
 */
export const GOOD_TYPE_MAP: Record<GoodType, string> = {
  single: '单日营',
  multi: '多日营',
  deposit: '定金',
}

/**
 * 获取商品类型标签
 */
export const getGoodTypeLabel = (type: string): string => {
  return GOOD_TYPE_MAP[type as GoodType] || '--'
}
