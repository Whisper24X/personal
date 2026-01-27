CREATE TABLE public.sys_dept (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pid character varying(64),
    type character varying(64),
    name character varying(64) NOT NULL,
    remark character varying(255),
    status smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
COMMENT ON TABLE public.sys_dept IS '系统-部门';
COMMENT ON COLUMN public.sys_dept.id IS '编号';
COMMENT ON COLUMN public.sys_dept.pid IS '父级id';
COMMENT ON COLUMN public.sys_dept.type IS '部门类型';
COMMENT ON COLUMN public.sys_dept.name IS '部门简称';
COMMENT ON COLUMN public.sys_dept.remark IS '备注';
COMMENT ON COLUMN public.sys_dept.status IS '-1=禁用 1=开启';
COMMENT ON COLUMN public.sys_dept.created_at IS '创建时间';
COMMENT ON COLUMN public.sys_dept.updated_at IS '更新时间';
ALTER TABLE ONLY public.sys_dept
    ADD CONSTRAINT sys_dept_pkey PRIMARY KEY (id);
CREATE INDEX sys_dept_pid_idx ON public.sys_dept USING btree (pid);
CREATE INDEX sys_dept_type_idx ON public.sys_dept USING btree (type);
