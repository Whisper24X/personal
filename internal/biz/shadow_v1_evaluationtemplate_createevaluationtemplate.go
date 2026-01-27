package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// CreateEvaluationTemplate 评价模版-创建一条数据
func (s *ShadowV1EvaluationTemplateUseCase) CreateEvaluationTemplate(ctx context.Context, req *pb.CreateEvaluationTemplateReq) (*pb.CreateEvaluationTemplateReply, error) {
	resp := &pb.CreateEvaluationTemplateReply{}
	adminId := meta.GetAdminID(ctx)
	// 先校验评价模版名称是否存在
	template, err := s.evaluationTemplateRepo.FindOneByTemplateName(ctx, req.TemplateName)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if template != nil && template.ID != "" {
		return resp, errors.New(http.StatusBadRequest, "-1", "评价模版名称已存在")
	}
	evaluationDimension, err := jsonutil.Marshal(req.EvaluationDimension)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	evaluationLabel, err := jsonutil.Marshal(req.EvaluationLabel)
	if err != nil {
		return resp, errorx.DataFormattingError.WithError(err).Err()
	}
	evaluationTemplate := &yanxue_model.EvaluationTemplate{
		TemplateName:        req.TemplateName,
		EvaluationObject:    req.EvaluationObject,
		Business:            req.Business,
		EvaluationDimension: evaluationDimension,
		EvaluationLabel:     evaluationLabel,
		Tips:                req.Tips,
		Status:              int32(constant.StatusEnable),
		UpdatedBy:           adminId,
	}
	err = s.evaluationTemplateRepo.CreateOneCache(ctx, evaluationTemplate)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Id = evaluationTemplate.ID
	return resp, nil
}
