-- 数据库变更：为 good 表添加 stock 字段和索引
-- 变更日期：2026-01-30
-- 变更说明：支持定金商品库存管理，NULL 表示无限库存

-- 1. 添加 stock 字段
ALTER TABLE public.good 
ADD COLUMN stock INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.good.stock IS '库存数量，NULL表示无限库存';

-- 2. 创建索引优化库存查询性能（仅对非NULL值建立索引）
CREATE INDEX idx_good_stock ON public.good(stock) WHERE stock IS NOT NULL;

-- 3. 验证：确认现有商品 stock 为 NULL（表示无限库存）
-- SELECT COUNT(*) FROM public.good WHERE stock IS NOT NULL; -- 应该返回 0
