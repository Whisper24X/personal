CREATE TABLE public.sys_admin (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ph character varying(255) NOT NULL,
    pw character varying(128) NOT NULL,
    salt character varying(32) NOT NULL,
    nickname character varying(64) NOT NULL,
    avatar character varying(500),
    status smallint DEFAULT 1 NOT NULL,
    "isChangePwd" boolean DEFAULT false,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
COMMENT ON TABLE public.sys_admin IS '系统-用户';
COMMENT ON COLUMN public.sys_admin.id IS 'id';
COMMENT ON COLUMN public.sys_admin.ph IS '手机号(加密)';
COMMENT ON COLUMN public.sys_admin.pw IS '密码';
COMMENT ON COLUMN public.sys_admin.salt IS '盐值';
COMMENT ON COLUMN public.sys_admin.nickname IS '昵称';
COMMENT ON COLUMN public.sys_admin.avatar IS '头像';
COMMENT ON COLUMN public.sys_admin.status IS '-1=禁用 1=开启';
COMMENT ON COLUMN public.sys_admin."isChangePwd" IS '是否修改过密码';
COMMENT ON COLUMN public.sys_admin."createdAt" IS '创建时间';
COMMENT ON COLUMN public.sys_admin."updatedAt" IS '更新时间';
ALTER TABLE ONLY public.sys_admin
    ADD CONSTRAINT sys_admin_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX sys_admin_ph_idx ON public.sys_admin USING btree (ph);
