package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.NpsGoLearnSceneNumRepo = (*NpsGoLearnSceneNumRepo)(nil)

func NewNpsGoLearnSceneNumRepo(
	logger log.Logger,
	data *Data,
	npsGoLearnSceneNumRepo *devices_learn_repo.NpsGoLearnSceneNumRepo,
) biz.NpsGoLearnSceneNumRepo {
	l := log.NewHelper(log.With(logger, "module", "data/npsGoLearnSceneNum"))
	return &NpsGoLearnSceneNumRepo{
		log:                    l,
		data:                   data,
		NpsGoLearnSceneNumRepo: npsGoLearnSceneNumRepo,
	}
}

type NpsGoLearnSceneNumRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.NpsGoLearnSceneNumRepo
}
