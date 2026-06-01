CREATE TABLE public.sys_data_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "operationType" character varying(64) NOT NULL,
    "operatorId" character varying(64) NOT NULL,
    "oldData" jsonb,
    "newData" jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedBy" character varying(64)
);
COMMENT ON TABLE public.sys_data_log IS '系统-数据日志';
COMMENT ON COLUMN public.sys_data_log.id IS '主键ID（UUID自动生成）';
COMMENT ON COLUMN public.sys_data_log."operationType" IS '操作类型';
COMMENT ON COLUMN public.sys_data_log."operatorId" IS '操作数据Id';
COMMENT ON COLUMN public.sys_data_log."oldData" IS '旧数据';
COMMENT ON COLUMN public.sys_data_log."newData" IS '新数据';
COMMENT ON COLUMN public.sys_data_log."createdAt" IS '创建时间';
COMMENT ON COLUMN public.sys_data_log."updatedBy" IS '操作人';
ALTER TABLE ONLY public.sys_data_log
    ADD CONSTRAINT sys_data_log_pkey PRIMARY KEY (id);
CREATE INDEX "sys_data_log_operationType_operatorId_idx" ON public.sys_data_log USING btree ("operationType", "operatorId");
