package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1SysPermissionUseCase(
	logger log.Logger,
	sysPermissionRepo SysPermissionRepo,
	sysRoleToPermissionRepo SysRolePermissionRepo,
) *ShadowV1SysPermissionUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1SysPermission"), log.WithMessageKey("message"))
	return &ShadowV1SysPermissionUseCase{
		log:                     l,
		sysPermissionRepo:       sysPermissionRepo,
		sysRoleToPermissionRepo: sysRoleToPermissionRepo,
	}
}

type ShadowV1SysPermissionUseCase struct {
	log                     *log.Helper
	sysPermissionRepo       SysPermissionRepo
	sysRoleToPermissionRepo SysRolePermissionRepo
}
