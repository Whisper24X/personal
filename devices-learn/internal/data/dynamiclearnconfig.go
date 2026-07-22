package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.DynamicLearnConfigRepo = (*DynamicLearnConfigRepo)(nil)

func NewDynamicLearnConfigRepo(
	logger log.Logger,
	data *Data,
	dynamicLearnConfigRepo *devices_learn_repo.DynamicLearnConfigRepo,
) biz.DynamicLearnConfigRepo {
	l := log.NewHelper(log.With(logger, "module", "data/dynamicLearnConfig"))
	return &DynamicLearnConfigRepo{
		log:                    l,
		data:                   data,
		DynamicLearnConfigRepo: dynamicLearnConfigRepo,
	}
}

type DynamicLearnConfigRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.DynamicLearnConfigRepo
}
