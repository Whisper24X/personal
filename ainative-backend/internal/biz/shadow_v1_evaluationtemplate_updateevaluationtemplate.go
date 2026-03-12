package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// UpdateEvaluationTemplate 评价模版-更新一条数据
func (s *ShadowV1EvaluationTemplateUseCase) UpdateEvaluationTemplate(ctx context.Context, req *pb.UpdateEvaluationTemplateReq) (*pb.UpdateEvaluationTemplateReply, error) {
	resp := &pb.UpdateEvaluationTemplateReply{}
	adminId := meta.GetAdminID(ctx)
	evaluationTemplate, err := s.evaluationTemplateRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	oldEvaluationTemplate := s.evaluationTemplateRepo.DeepCopy(evaluationTemplate)

	evaluationDimension, err := jsonutil.Marshal(req.EvaluationDimension)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	evaluationLabel, err := jsonutil.Marshal(req.EvaluationLabel)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	evaluationTemplate.TemplateName = req.TemplateName
	evaluationTemplate.EvaluationObject = req.EvaluationObject
	evaluationTemplate.Business = req.Business
	evaluationTemplate.EvaluationDimension = evaluationDimension
	evaluationTemplate.EvaluationLabel = evaluationLabel
	evaluationTemplate.Tips = req.Tips
	evaluationTemplate.UpdatedBy = adminId
	err = s.evaluationTemplateRepo.UpdateOneCache(ctx, evaluationTemplate, oldEvaluationTemplate)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
