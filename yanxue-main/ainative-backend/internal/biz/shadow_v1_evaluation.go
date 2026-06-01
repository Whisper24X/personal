package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1EvaluationUseCase(
	logger log.Logger,
	evaluationRepo EvaluationRepo,
	bffRepo BffRepo,
) *ShadowV1EvaluationUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1Evaluation"), log.WithMessageKey("message"))
	return &ShadowV1EvaluationUseCase{
		log:            l,
		evaluationRepo: evaluationRepo,
		bffRepo:        bffRepo,
	}
}

type ShadowV1EvaluationUseCase struct {
	log            *log.Helper
	evaluationRepo EvaluationRepo
	bffRepo        BffRepo
}
