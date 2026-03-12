package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1EvaluationTemplateUseCase(
	logger log.Logger,
	evaluationTemplateRepo EvaluationTemplateRepo,
	sysAdminRepo SysAdminRepo,
) *ShadowV1EvaluationTemplateUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1EvaluationTemplate"), log.WithMessageKey("message"))
	return &ShadowV1EvaluationTemplateUseCase{
		log:                    l,
		evaluationTemplateRepo: evaluationTemplateRepo,
		sysAdminRepo:           sysAdminRepo,
	}
}

type ShadowV1EvaluationTemplateUseCase struct {
	log                    *log.Helper
	evaluationTemplateRepo EvaluationTemplateRepo
	sysAdminRepo           SysAdminRepo
}
