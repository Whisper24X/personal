package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.SysAdminRoleRepo = (*SysAdminRoleRepo)(nil)

func NewSysAdminRoleRepo(
	logger log.Logger,
	data *Data,
	sysAdminRoleRepo *yanxue_repo.SysAdminRoleRepo,
) biz.SysAdminRoleRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysAdminRole"), log.WithMessageKey("message"))
	return &SysAdminRoleRepo{
		log:              l,
		data:             data,
		SysAdminRoleRepo: sysAdminRoleRepo,
	}
}

type SysAdminRoleRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SysAdminRoleRepo
}
