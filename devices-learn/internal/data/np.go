package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.NpRepo = (*NpRepo)(nil)

func NewNpRepo(
	logger log.Logger,
	data *Data,
	npRepo *devices_learn_repo.NpRepo,
) biz.NpRepo {
	l := log.NewHelper(log.With(logger, "module", "data/np"))
	return &NpRepo{
		log:    l,
		data:   data,
		NpRepo: npRepo,
	}
}

type NpRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.NpRepo
}
