package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.UserLearnStyleRepo = (*UserLearnStyleRepo)(nil)

func NewUserLearnStyleRepo(
	logger log.Logger,
	data *Data,
	userLearnStyleRepo *devices_learn_repo.UserLearnStyleRepo,
) biz.UserLearnStyleRepo {
	l := log.NewHelper(log.With(logger, "module", "data/userLearnStyle"))
	return &UserLearnStyleRepo{
		log:                l,
		data:               data,
		UserLearnStyleRepo: userLearnStyleRepo,
	}
}

type UserLearnStyleRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.UserLearnStyleRepo
}
