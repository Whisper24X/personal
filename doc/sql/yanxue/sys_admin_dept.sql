CREATE TABLE public.sys_admin_dept (
    "adminId" uuid,
    "deptId" uuid
);
COMMENT ON TABLE public.sys_admin_dept IS '系统-用户与部门关联';
COMMENT ON COLUMN public.sys_admin_dept."adminId" IS '管理员ID';
COMMENT ON COLUMN public.sys_admin_dept."deptId" IS '部门ID';
CREATE INDEX "sys_admin_dept_adminId_idx" ON public.sys_admin_dept USING btree ("adminId");
CREATE INDEX "sys_admin_dept_deptId_idx" ON public.sys_admin_dept USING btree ("deptId");
