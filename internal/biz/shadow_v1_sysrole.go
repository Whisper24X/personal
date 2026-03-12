package biz

import (
	"github.com/go-kratos/kratos/v2/log"
)

func NewShadowV1SysRoleUseCase(
	logger log.Logger,
	commonRepo CommonRepo,
	sysRoleRepo SysRoleRepo,
	sysRolePermissionRepo SysRolePermissionRepo,
	sysAdminRoleRepo SysAdminRoleRepo,
	sysAdminRepo SysAdminRepo,
) *ShadowV1SysRoleUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1SysRole"), log.WithMessageKey("message"))
	return &ShadowV1SysRoleUseCase{
		log:                   l,
		commonRepo:            commonRepo,
		sysRoleRepo:           sysRoleRepo,
		sysRolePermissionRepo: sysRolePermissionRepo,
		sysAdminRoleRepo:      sysAdminRoleRepo,
		sysAdminRepo:          sysAdminRepo,
	}
}

type ShadowV1SysRoleUseCase struct {
	log                   *log.Helper
	commonRepo            CommonRepo
	sysRoleRepo           SysRoleRepo
	sysRolePermissionRepo SysRolePermissionRepo
	sysAdminRoleRepo      SysAdminRoleRepo
	sysAdminRepo          SysAdminRepo
}
