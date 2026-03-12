package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1EvaluationTemplateService(
	logger log.Logger,
	wechatV1EvaluationTemplateUseCase *biz.WechatV1EvaluationTemplateUseCase,
) *WechatV1EvaluationTemplateService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1EvaluationTemplate"), log.WithMessageKey("message"))
	return &WechatV1EvaluationTemplateService{
		log:                               l,
		wechatV1EvaluationTemplateUseCase: wechatV1EvaluationTemplateUseCase,
	}
}

type WechatV1EvaluationTemplateService struct {
	pb.UnimplementedEvaluationTemplateServer
	log                               *log.Helper
	wechatV1EvaluationTemplateUseCase *biz.WechatV1EvaluationTemplateUseCase
}

// GetEvaluationTemplateInfo 评价模版-查询评价模版详情
func (w *WechatV1EvaluationTemplateService) GetEvaluationTemplateInfo(ctx context.Context, req *pb.GetEvaluationTemplateInfoReq) (*pb.GetEvaluationTemplateInfoReply, error) {
	return w.wechatV1EvaluationTemplateUseCase.GetEvaluationTemplateInfo(ctx, req)
}
