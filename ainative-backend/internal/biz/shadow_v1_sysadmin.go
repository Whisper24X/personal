package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1SysAdminUseCase(
	logger log.Logger,
	bffRepo BffRepo,
	commonRepo CommonRepo,
	sysAdminRepo SysAdminRepo,
	sysRoleRepo SysRoleRepo,
	sysDeptRepo SysDeptRepo,
	sysPermissionRepo SysPermissionRepo,
	sysAdminDeptRepo SysAdminDeptRepo,
	sysAdminRoleRepo SysAdminRoleRepo,
	sysRolePermissionRepo SysRolePermissionRepo,
) *ShadowV1SysAdminUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1SysAdmin"), log.WithMessageKey("message"))
	return &ShadowV1SysAdminUseCase{
		log:                   l,
		bffRepo:               bffRepo,
		commonRepo:            commonRepo,
		sysAdminRepo:          sysAdminRepo,
		sysRoleRepo:           sysRoleRepo,
		sysDeptRepo:           sysDeptRepo,
		sysPermissionRepo:     sysPermissionRepo,
		sysAdminDeptRepo:      sysAdminDeptRepo,
		sysAdminRoleRepo:      sysAdminRoleRepo,
		sysRolePermissionRepo: sysRolePermissionRepo,
	}
}

type ShadowV1SysAdminUseCase struct {
	log                   *log.Helper
	bffRepo               BffRepo
	commonRepo            CommonRepo
	sysAdminRepo          SysAdminRepo
	sysRoleRepo           SysRoleRepo
	sysDeptRepo           SysDeptRepo
	sysPermissionRepo     SysPermissionRepo
	sysAdminDeptRepo      SysAdminDeptRepo
	sysAdminRoleRepo      SysAdminRoleRepo
	sysRolePermissionRepo SysRolePermissionRepo
}
