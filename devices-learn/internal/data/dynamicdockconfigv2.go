package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.DynamicDockConfigV2Repo = (*DynamicDockConfigV2Repo)(nil)

func NewDynamicDockConfigV2Repo(
	logger log.Logger,
	data *Data,
	dynamicDockConfigV2Repo *devices_learn_repo.DynamicDockConfigV2Repo,
) biz.DynamicDockConfigV2Repo {
	l := log.NewHelper(log.With(logger, "module", "data/dynamicDockConfigV2"))
	return &DynamicDockConfigV2Repo{
		log:                     l,
		data:                    data,
		DynamicDockConfigV2Repo: dynamicDockConfigV2Repo,
	}
}

type DynamicDockConfigV2Repo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.DynamicDockConfigV2Repo
}
