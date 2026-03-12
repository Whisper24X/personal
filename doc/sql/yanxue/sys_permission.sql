CREATE TABLE public.sys_permission (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pid character varying(50),
    type character varying(32) NOT NULL,
    title character varying(50) NOT NULL,
    name character varying(50),
    path character varying(100) NOT NULL,
    icon character varying(50),
    "menuType" character varying(32),
    url character varying(255),
    component character varying(100),
    extend character varying(255),
    remark character varying(255),
    status smallint NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);
COMMENT ON TABLE public.sys_permission IS '系统-权限表';
COMMENT ON COLUMN public.sys_permission.id IS '编号';
COMMENT ON COLUMN public.sys_permission.pid IS '上级菜单';
COMMENT ON COLUMN public.sys_permission.type IS '类型:menu_dir=菜单目录,menu=菜单项,button=页面按钮';
COMMENT ON COLUMN public.sys_permission.title IS '标题';
COMMENT ON COLUMN public.sys_permission.name IS '规则名称';
COMMENT ON COLUMN public.sys_permission.path IS '路由路径';
COMMENT ON COLUMN public.sys_permission.icon IS '图标';
COMMENT ON COLUMN public.sys_permission."menuType" IS '菜单类型:tab=选项卡,link=链接,iframe=Iframe';
COMMENT ON COLUMN public.sys_permission.url IS 'Url';
COMMENT ON COLUMN public.sys_permission.component IS '组件路径';
COMMENT ON COLUMN public.sys_permission.extend IS '扩展属性:none=无,add_rules_only=只添加为路由,add_menu_only=只添加为菜单';
COMMENT ON COLUMN public.sys_permission.remark IS '备注';
COMMENT ON COLUMN public.sys_permission.status IS '-1=禁用 1=开启';
COMMENT ON COLUMN public.sys_permission."createdAt" IS '创建时间';
COMMENT ON COLUMN public.sys_permission."updatedAt" IS '更新时间';
ALTER TABLE ONLY public.sys_permission
    ADD CONSTRAINT sys_permission_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX sys_permission_path_idx ON public.sys_permission USING btree (path);
CREATE INDEX sys_permission_pid_idx ON public.sys_permission USING btree (pid);
