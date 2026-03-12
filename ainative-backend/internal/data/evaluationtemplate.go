package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.EvaluationTemplateRepo = (*EvaluationTemplateRepo)(nil)

func NewEvaluationTemplateRepo(
	logger log.Logger,
	data *Data,
	evaluationTemplateRepo *yanxue_repo.EvaluationTemplateRepo,
) biz.EvaluationTemplateRepo {
	l := log.NewHelper(log.With(logger, "module", "data/evaluationTemplate"), log.WithMessageKey("message"))
	return &EvaluationTemplateRepo{
		log:                    l,
		data:                   data,
		EvaluationTemplateRepo: evaluationTemplateRepo,
	}
}

type EvaluationTemplateRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.EvaluationTemplateRepo
}
