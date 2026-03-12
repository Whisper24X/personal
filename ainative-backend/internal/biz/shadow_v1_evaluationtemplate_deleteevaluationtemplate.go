package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// DeleteEvaluationTemplate 评价模版-删除多条数据
func (s *ShadowV1EvaluationTemplateUseCase) DeleteEvaluationTemplate(ctx context.Context, req *pb.DeleteEvaluationTemplateReq) (*pb.DeleteEvaluationTemplateReply, error) {
	resp := &pb.DeleteEvaluationTemplateReply{}
	err := s.evaluationTemplateRepo.DeleteOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
