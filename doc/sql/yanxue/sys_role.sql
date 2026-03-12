CREATE TABLE public.sys_role (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(64) NOT NULL,
    remark character varying(200),
    "dataPermission" character varying(32),
    status smallint DEFAULT 1 NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);
COMMENT ON TABLE public.sys_role IS '系统-角色';
COMMENT ON COLUMN public.sys_role.id IS 'id';
COMMENT ON COLUMN public.sys_role.name IS '名称';
COMMENT ON COLUMN public.sys_role.remark IS '备注';
COMMENT ON COLUMN public.sys_role."dataPermission" IS '数据权限';
COMMENT ON COLUMN public.sys_role.status IS '-1=禁用 1=开启';
COMMENT ON COLUMN public.sys_role."createdAt" IS '创建时间';
COMMENT ON COLUMN public.sys_role."updatedAt" IS '更新时间';
ALTER TABLE ONLY public.sys_role
    ADD CONSTRAINT sys_role_pkey PRIMARY KEY (id);
