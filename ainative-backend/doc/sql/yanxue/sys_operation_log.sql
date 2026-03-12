CREATE TABLE public.sys_operation_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "adminId" uuid NOT NULL,
    ip character varying(32) NOT NULL,
    method character varying(8),
    uri character varying(200) NOT NULL,
    useragent character varying(255),
    header json,
    req json,
    resp json,
    "createdAt" timestamp with time zone
);
COMMENT ON TABLE public.sys_operation_log IS '系统-操作日志';
COMMENT ON COLUMN public.sys_operation_log.id IS '编号';
COMMENT ON COLUMN public.sys_operation_log."adminId" IS '管理员ID';
COMMENT ON COLUMN public.sys_operation_log.ip IS 'ip';
COMMENT ON COLUMN public.sys_operation_log.method IS '方法';
COMMENT ON COLUMN public.sys_operation_log.uri IS '请求路径';
COMMENT ON COLUMN public.sys_operation_log.useragent IS '浏览器标识';
COMMENT ON COLUMN public.sys_operation_log.header IS 'header';
COMMENT ON COLUMN public.sys_operation_log.req IS '请求数据';
COMMENT ON COLUMN public.sys_operation_log.resp IS '响应数据';
COMMENT ON COLUMN public.sys_operation_log."createdAt" IS '创建时间';
ALTER TABLE ONLY public.sys_operation_log
    ADD CONSTRAINT sys_operation_log_pkey PRIMARY KEY (id);
CREATE INDEX "sys_operation_log_adminId_idx" ON public.sys_operation_log USING btree ("adminId");
