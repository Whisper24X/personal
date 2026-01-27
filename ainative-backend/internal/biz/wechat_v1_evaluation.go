package biz

import "github.com/go-kratos/kratos/v2/log"

func NewWechatV1EvaluationUseCase(
	logger log.Logger,
	evaluationRepo EvaluationRepo,
) *WechatV1EvaluationUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1Evaluation"), log.WithMessageKey("message"))
	return &WechatV1EvaluationUseCase{
		log:            l,
		evaluationRepo: evaluationRepo,
	}
}

type WechatV1EvaluationUseCase struct {
	log            *log.Helper
	evaluationRepo EvaluationRepo
}
