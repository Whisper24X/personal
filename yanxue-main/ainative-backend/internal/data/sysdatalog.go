package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.SysDataLogRepo = (*SysDataLogRepo)(nil)

func NewSysDataLogRepo(
	logger log.Logger,
	data *Data,
	sysDataLogRepo *yanxue_repo.SysDataLogRepo,
) biz.SysDataLogRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysDataLog"), log.WithMessageKey("message"))
	return &SysDataLogRepo{
		log:            l,
		data:           data,
		SysDataLogRepo: sysDataLogRepo,
	}
}

type SysDataLogRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SysDataLogRepo
}
