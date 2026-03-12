package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.SysAdminDeptRepo = (*SysAdminDeptRepo)(nil)

func NewSysAdminDeptRepo(
	logger log.Logger,
	data *Data,
	sysAdminDeptRepo *yanxue_repo.SysAdminDeptRepo,
) biz.SysAdminDeptRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysAdminDept"), log.WithMessageKey("message"))
	return &SysAdminDeptRepo{
		log:              l,
		data:             data,
		SysAdminDeptRepo: sysAdminDeptRepo,
	}
}

type SysAdminDeptRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SysAdminDeptRepo
}
