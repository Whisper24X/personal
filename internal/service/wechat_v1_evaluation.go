package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1EvaluationService(
	logger log.Logger,
	wechatV1EvaluationUseCase *biz.WechatV1EvaluationUseCase,
) *WechatV1EvaluationService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1Evaluation"), log.WithMessageKey("message"))
	return &WechatV1EvaluationService{
		log:                       l,
		wechatV1EvaluationUseCase: wechatV1EvaluationUseCase,
	}
}

type WechatV1EvaluationService struct {
	pb.UnimplementedEvaluationServer
	log                       *log.Helper
	wechatV1EvaluationUseCase *biz.WechatV1EvaluationUseCase
}

// CreateEvaluation 评价表-创建一条数据
func (w *WechatV1EvaluationService) CreateEvaluation(ctx context.Context, req *pb.CreateEvaluationReq) (*pb.CreateEvaluationReply, error) {
	return w.wechatV1EvaluationUseCase.CreateEvaluation(ctx, req)
}
