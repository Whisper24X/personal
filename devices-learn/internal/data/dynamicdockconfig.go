package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.DynamicDockConfigRepo = (*DynamicDockConfigRepo)(nil)

func NewDynamicDockConfigRepo(
	logger log.Logger,
	data *Data,
	dynamicDockConfigRepo *devices_learn_repo.DynamicDockConfigRepo,
) biz.DynamicDockConfigRepo {
	l := log.NewHelper(log.With(logger, "module", "data/dynamicDockConfig"))
	return &DynamicDockConfigRepo{
		log:                   l,
		data:                  data,
		DynamicDockConfigRepo: dynamicDockConfigRepo,
	}
}

type DynamicDockConfigRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.DynamicDockConfigRepo
}
