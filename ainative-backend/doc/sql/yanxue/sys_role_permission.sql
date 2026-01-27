CREATE TABLE public.sys_role_permission (
    "roleId" uuid NOT NULL,
    "permissionId" uuid NOT NULL
);
COMMENT ON TABLE public.sys_role_permission IS '系统-角色绑定权限';
COMMENT ON COLUMN public.sys_role_permission."roleId" IS '角色ID';
COMMENT ON COLUMN public.sys_role_permission."permissionId" IS '功能权限ID';
CREATE INDEX "sys_role_permission_permissionId_idx" ON public.sys_role_permission USING btree ("permissionId");
CREATE INDEX "sys_role_permission_roleId_idx" ON public.sys_role_permission USING btree ("roleId");
