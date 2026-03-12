package biz

import "github.com/go-kratos/kratos/v2/log"

func NewWechatV1EvaluationTemplateUseCase(
	logger log.Logger,
	evaluationTemplateRepo EvaluationTemplateRepo,
) *WechatV1EvaluationTemplateUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1EvaluationTemplate"), log.WithMessageKey("message"))
	return &WechatV1EvaluationTemplateUseCase{
		log:                    l,
		evaluationTemplateRepo: evaluationTemplateRepo,
	}
}

type WechatV1EvaluationTemplateUseCase struct {
	log                    *log.Helper
	evaluationTemplateRepo EvaluationTemplateRepo
}
