package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1EvaluationService(
	logger log.Logger,
	shadowV1EvaluationUseCase *biz.ShadowV1EvaluationUseCase,
) *ShadowV1EvaluationService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1Evaluation"), log.WithMessageKey("message"))
	return &ShadowV1EvaluationService{
		log:                       l,
		shadowV1EvaluationUseCase: shadowV1EvaluationUseCase,
	}
}

type ShadowV1EvaluationService struct {
	pb.UnimplementedEvaluationServer
	log                       *log.Helper
	shadowV1EvaluationUseCase *biz.ShadowV1EvaluationUseCase
}

// GetEvaluationList 评价表-列表数据查询
func (s *ShadowV1EvaluationService) GetEvaluationList(ctx context.Context, req *pb.GetEvaluationListReq) (*pb.GetEvaluationListReply, error) {
	return s.shadowV1EvaluationUseCase.GetEvaluationList(ctx, req)
}

// ExportEvaluationList 评价表-导出评价列表
func (s *ShadowV1EvaluationService) ExportEvaluationList(ctx context.Context, req *pb.ExportEvaluationListReq) (*pb.ExportEvaluationListReply, error) {
	return s.shadowV1EvaluationUseCase.ExportEvaluationList(ctx, req)
}
