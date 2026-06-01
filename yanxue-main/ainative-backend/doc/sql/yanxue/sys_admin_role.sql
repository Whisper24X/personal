CREATE TABLE public.sys_admin_role (
    "adminId" uuid,
    "roleId" uuid
);
COMMENT ON TABLE public.sys_admin_role IS '系统-用户与角色关联';
COMMENT ON COLUMN public.sys_admin_role."adminId" IS '管理员ID';
COMMENT ON COLUMN public.sys_admin_role."roleId" IS '角色ID';
CREATE INDEX "sys_admin_role_adminId_idx" ON public.sys_admin_role USING btree ("adminId");
CREATE INDEX "sys_admin_role_roleId_idx" ON public.sys_admin_role USING btree ("roleId");
