package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.DynamicFunctionConfigRepo = (*DynamicFunctionConfigRepo)(nil)

func NewDynamicFunctionConfigRepo(
	logger log.Logger,
	data *Data,
	dynamicFunctionConfigRepo *devices_learn_repo.DynamicFunctionConfigRepo,
) biz.DynamicFunctionConfigRepo {
	l := log.NewHelper(log.With(logger, "module", "data/dynamicFunctionConfig"))
	return &DynamicFunctionConfigRepo{
		log:                       l,
		data:                      data,
		DynamicFunctionConfigRepo: dynamicFunctionConfigRepo,
	}
}

type DynamicFunctionConfigRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.DynamicFunctionConfigRepo
}
