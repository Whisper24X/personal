package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.SysRolePermissionRepo = (*SysRolePermissionRepo)(nil)

func NewSysRolePermissionRepo(
	logger log.Logger,
	data *Data,
	sysRolePermissionRepo *yanxue_repo.SysRolePermissionRepo,
) biz.SysRolePermissionRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysRolePermission"), log.WithMessageKey("message"))
	return &SysRolePermissionRepo{
		log:                   l,
		data:                  data,
		SysRolePermissionRepo: sysRolePermissionRepo,
	}
}

type SysRolePermissionRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SysRolePermissionRepo
}
