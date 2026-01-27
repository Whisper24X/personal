package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.EvaluationRepo = (*EvaluationRepo)(nil)

func NewEvaluationRepo(
	logger log.Logger,
	data *Data,
	evaluationRepo *yanxue_repo.EvaluationRepo,
) biz.EvaluationRepo {
	l := log.NewHelper(log.With(logger, "module", "data/evaluation"), log.WithMessageKey("message"))
	return &EvaluationRepo{
		log:            l,
		data:           data,
		EvaluationRepo: evaluationRepo,
	}
}

type EvaluationRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.EvaluationRepo
}
