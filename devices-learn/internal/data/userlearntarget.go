package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

var _ biz.UserLearnTargetRepo = (*UserLearnTargetRepo)(nil)

func NewUserLearnTargetRepo(
	logger log.Logger,
	data *Data,
	userLearnTargetRepo *devices_learn_repo.UserLearnTargetRepo,
) biz.UserLearnTargetRepo {
	l := log.NewHelper(log.With(logger, "module", "data/userLearnTarget"))
	return &UserLearnTargetRepo{
		log:                 l,
		data:                data,
		UserLearnTargetRepo: userLearnTargetRepo,
	}
}

type UserLearnTargetRepo struct {
	log  *log.Helper
	data *Data
	*devices_learn_repo.UserLearnTargetRepo
}
