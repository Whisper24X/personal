-- 数据库回滚脚本：移除 good 表的 stock 字段和索引
-- 变更日期：2026-01-30
-- 回滚说明：回滚库存字段相关变更

-- 1. 删除索引
DROP INDEX IF EXISTS public.idx_good_stock;

-- 2. 删除 stock 字段
ALTER TABLE public.good 
DROP COLUMN IF EXISTS stock;
