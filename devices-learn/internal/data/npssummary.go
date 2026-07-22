package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.NpsSummaryRepo = (*NpsSummaryRepo)(nil)

func NewNpsSummaryRepo(
	logger log.Logger,
	data *Data,
	npsSummaryRepo *devices_learn_repo.NpsSummaryRepo,
) biz.NpsSummaryRepo {
	l := log.NewHelper(log.With(logger, "module", "data/npsSummary"))
	return &NpsSummaryRepo{
		log:            l,
		data:           data,
		NpsSummaryRepo: npsSummaryRepo,
	}
}

type NpsSummaryRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.NpsSummaryRepo
}
