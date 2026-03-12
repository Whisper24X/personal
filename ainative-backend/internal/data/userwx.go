package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.UserWxRepo = (*UserWxRepo)(nil)

func NewUserWxRepo(
	logger log.Logger,
	data *Data,
	userWxRepo *yanxue_repo.UserWxRepo,
) biz.UserWxRepo {
	l := log.NewHelper(log.With(logger, "module", "data/userWx"), log.WithMessageKey("message"))
	return &UserWxRepo{
		log:        l,
		data:       data,
		UserWxRepo: userWxRepo,
	}
}

type UserWxRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.UserWxRepo
}
