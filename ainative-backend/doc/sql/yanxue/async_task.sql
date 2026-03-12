CREATE TABLE public.async_task (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "taskType" character varying(32) NOT NULL,
    status integer NOT NULL,
    "errorInfo" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
COMMENT ON TABLE public.async_task IS '异步任务表';
COMMENT ON COLUMN public.async_task.id IS '主键ID（UUID自动生成）';
COMMENT ON COLUMN public.async_task."taskType" IS '任务类型';
COMMENT ON COLUMN public.async_task.status IS '状态：0-待处理 1-执行中 2-成功 3-失败';
COMMENT ON COLUMN public.async_task."errorInfo" IS '错误详情';
COMMENT ON COLUMN public.async_task."createdAt" IS '创建时间';
COMMENT ON COLUMN public.async_task."updatedAt" IS '最后更新时间';
ALTER TABLE ONLY public.async_task
    ADD CONSTRAINT async_task_pkey PRIMARY KEY (id);
