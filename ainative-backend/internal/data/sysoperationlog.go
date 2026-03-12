package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.SysOperationLogRepo = (*SysOperationLogRepo)(nil)

func NewSysOperationLogRepo(
	logger log.Logger,
	data *Data,
	sysOperationLogRepo *yanxue_repo.SysOperationLogRepo,
) biz.SysOperationLogRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysOperationLog"), log.WithMessageKey("message"))
	return &SysOperationLogRepo{
		log:                 l,
		data:                data,
		SysOperationLogRepo: sysOperationLogRepo,
	}
}

type SysOperationLogRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SysOperationLogRepo
}
