package biz

import (
	"context"
	"time"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetEvaluationTemplateInfo 评价模版-单条数据查询
func (s *ShadowV1EvaluationTemplateUseCase) GetEvaluationTemplateInfo(ctx context.Context, req *pb.GetEvaluationTemplateInfoReq) (*pb.GetEvaluationTemplateInfoReply, error) {
	resp := &pb.GetEvaluationTemplateInfoReply{}
	evaluationTemplateInfo, err := s.evaluationTemplateRepo.FindOneCacheByID(ctx, req.Id)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	var evaluationDimension []string
	err = jsonutil.Unmarshal(evaluationTemplateInfo.EvaluationDimension, &evaluationDimension)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	var evaluationLabel []string
	err = jsonutil.Unmarshal(evaluationTemplateInfo.EvaluationLabel, &evaluationLabel)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, []string{evaluationTemplateInfo.UpdatedBy})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp = &pb.GetEvaluationTemplateInfoReply{
		Info: &pb.EvaluationTemplateInfo{
			Id:                  evaluationTemplateInfo.ID,
			TemplateName:        evaluationTemplateInfo.TemplateName,
			EvaluationObject:    evaluationTemplateInfo.EvaluationObject,
			Business:            evaluationTemplateInfo.Business,
			EvaluationDimension: evaluationDimension,
			EvaluationLabel:     evaluationLabel,
			Tips:                evaluationTemplateInfo.Tips,
			CreatedAt:           evaluationTemplateInfo.CreatedAt.Format(time.RFC3339),
			UpdatedAt:           evaluationTemplateInfo.UpdatedAt.Format(time.RFC3339),
			UpdatedBy:           evaluationTemplateInfo.UpdatedBy,
			UpdatedByName:       adminMap[evaluationTemplateInfo.UpdatedBy],
		},
	}
	return resp, nil
}
