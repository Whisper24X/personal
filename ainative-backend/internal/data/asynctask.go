package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.AsyncTaskRepo = (*AsyncTaskRepo)(nil)

func NewAsyncTaskRepo(
	logger log.Logger,
	data *Data,
	asyncTaskRepo *yanxue_repo.AsyncTaskRepo,
) biz.AsyncTaskRepo {
	l := log.NewHelper(log.With(logger, "module", "data/asyncTask"), log.WithMessageKey("message"))
	return &AsyncTaskRepo{
		log:           l,
		data:          data,
		AsyncTaskRepo: asyncTaskRepo,
	}
}

type AsyncTaskRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.AsyncTaskRepo
}
