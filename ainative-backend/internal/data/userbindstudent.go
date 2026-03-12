package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.UserBindStudentRepo = (*UserBindStudentRepo)(nil)

func NewUserBindStudentRepo(
	logger log.Logger,
	data *Data,
	userBindStudentRepo *yanxue_repo.UserBindStudentRepo,
) biz.UserBindStudentRepo {
	l := log.NewHelper(log.With(logger, "module", "data/userBindStudent"), log.WithMessageKey("message"))
	return &UserBindStudentRepo{
		log:                 l,
		data:                data,
		UserBindStudentRepo: userBindStudentRepo,
	}
}

type UserBindStudentRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.UserBindStudentRepo
}
