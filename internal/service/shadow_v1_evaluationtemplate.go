package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1EvaluationTemplateService(
	logger log.Logger,
	shadowV1EvaluationTemplateUseCase *biz.ShadowV1EvaluationTemplateUseCase,
) *ShadowV1EvaluationTemplateService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1EvaluationTemplate"), log.WithMessageKey("message"))
	return &ShadowV1EvaluationTemplateService{
		log:                               l,
		shadowV1EvaluationTemplateUseCase: shadowV1EvaluationTemplateUseCase,
	}
}

type ShadowV1EvaluationTemplateService struct {
	pb.UnimplementedEvaluationTemplateServer
	log                               *log.Helper
	shadowV1EvaluationTemplateUseCase *biz.ShadowV1EvaluationTemplateUseCase
}

// CreateEvaluationTemplate 评价模版-创建一条数据
func (s *ShadowV1EvaluationTemplateService) CreateEvaluationTemplate(ctx context.Context, req *pb.CreateEvaluationTemplateReq) (*pb.CreateEvaluationTemplateReply, error) {
	return s.shadowV1EvaluationTemplateUseCase.CreateEvaluationTemplate(ctx, req)
}

// UpdateEvaluationTemplate 评价模版-更新一条数据
func (s *ShadowV1EvaluationTemplateService) UpdateEvaluationTemplate(ctx context.Context, req *pb.UpdateEvaluationTemplateReq) (*pb.UpdateEvaluationTemplateReply, error) {
	return s.shadowV1EvaluationTemplateUseCase.UpdateEvaluationTemplate(ctx, req)
}

// DeleteEvaluationTemplate 评价模版-删除多条数据
func (s *ShadowV1EvaluationTemplateService) DeleteEvaluationTemplate(ctx context.Context, req *pb.DeleteEvaluationTemplateReq) (*pb.DeleteEvaluationTemplateReply, error) {
	return s.shadowV1EvaluationTemplateUseCase.DeleteEvaluationTemplate(ctx, req)
}

// GetEvaluationTemplateInfo 评价模版-单条数据查询
func (s *ShadowV1EvaluationTemplateService) GetEvaluationTemplateInfo(ctx context.Context, req *pb.GetEvaluationTemplateInfoReq) (*pb.GetEvaluationTemplateInfoReply, error) {
	return s.shadowV1EvaluationTemplateUseCase.GetEvaluationTemplateInfo(ctx, req)
}

// GetEvaluationTemplateList 评价模版-列表数据查询
func (s *ShadowV1EvaluationTemplateService) GetEvaluationTemplateList(ctx context.Context, req *pb.GetEvaluationTemplateListReq) (*pb.GetEvaluationTemplateListReply, error) {
	return s.shadowV1EvaluationTemplateUseCase.GetEvaluationTemplateList(ctx, req)
}
