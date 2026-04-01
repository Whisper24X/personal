-- 为 channel 表 name 字段添加 UNIQUE 约束
-- 执行前请确认无重名数据：SELECT name, COUNT(*) FROM channel GROUP BY name HAVING COUNT(*) > 1;
ALTER TABLE public.channel
ADD CONSTRAINT channel_name_unique UNIQUE (name);
