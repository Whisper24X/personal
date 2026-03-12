package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetEvaluationTemplateInfo 评价模版-查询评价模版详情
func (w *WechatV1EvaluationTemplateUseCase) GetEvaluationTemplateInfo(ctx context.Context, req *pb.GetEvaluationTemplateInfoReq) (*pb.GetEvaluationTemplateInfoReply, error) {
	resp := &pb.GetEvaluationTemplateInfoReply{}
	evaluationTemplateInfo, err := w.evaluationTemplateRepo.FindOneByTemplateName(ctx, req.TemplateName)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if evaluationTemplateInfo == nil || evaluationTemplateInfo.ID == "" {
		return resp, errors.New(http.StatusBadRequest, "-1", "未找到评价模版！")
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
	resp = &pb.GetEvaluationTemplateInfoReply{
		Info: &pb.EvaluationTemplateInfo{
			Id:                  evaluationTemplateInfo.ID,
			TemplateName:        evaluationTemplateInfo.TemplateName,
			EvaluationObject:    evaluationTemplateInfo.EvaluationObject,
			Business:            evaluationTemplateInfo.Business,
			EvaluationDimension: evaluationDimension,
			EvaluationLabel:     evaluationLabel,
			Tips:                evaluationTemplateInfo.Tips,
		},
	}
	return resp, nil
}
