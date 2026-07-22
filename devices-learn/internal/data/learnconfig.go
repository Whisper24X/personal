package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.LearnConfigRepo = (*LearnConfigRepo)(nil)

func NewLearnConfigRepo(
	logger log.Logger,
	data *Data,
	learnConfigRepo *devices_learn_repo.LearnConfigRepo,
) biz.LearnConfigRepo {
	l := log.NewHelper(log.With(logger, "module", "data/learnConfig"))
	return &LearnConfigRepo{
		log:             l,
		data:            data,
		LearnConfigRepo: learnConfigRepo,
	}
}

type LearnConfigRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.LearnConfigRepo
}
