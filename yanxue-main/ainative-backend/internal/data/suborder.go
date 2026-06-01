package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.SubOrderRepo = (*SubOrderRepo)(nil)

func NewSubOrderRepo(
	logger log.Logger,
	data *Data,
	subOrderRepo *yanxue_repo.SubOrderRepo,
) biz.SubOrderRepo {
	l := log.NewHelper(log.With(logger, "module", "data/subOrder"))
	return &SubOrderRepo{
		log:          l,
		data:         data,
		SubOrderRepo: subOrderRepo,
	}
}

type SubOrderRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SubOrderRepo
}
