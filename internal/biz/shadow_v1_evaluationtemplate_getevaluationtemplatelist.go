package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetEvaluationTemplateList 评价模版-列表数据查询
func (s *ShadowV1EvaluationTemplateUseCase) GetEvaluationTemplateList(ctx context.Context, req *pb.GetEvaluationTemplateListReq) (*pb.GetEvaluationTemplateListReply, error) {
	resp := &pb.GetEvaluationTemplateListReply{}
	page := int32(1)
	pageSize := int32(100)
	if req.GetPage() != 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() != 0 {
		pageSize = req.GetPageSize()
	}
	param := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "updatedAt",
				Order: condition.DESC,
			},
		},
	}
	if req.GetTemplateName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "templateName",
			Value: "%" + req.GetTemplateName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	// 查询状态为未删除的数据
	param.Query = append(param.Query, &condition.QueryParam{
		Field: "status",
		Value: int32(constant.StatusDelete),
		Exp:   condition.NEQ,
		Logic: condition.AND,
	})
	list, pageInfo, err := s.evaluationTemplateRepo.FindMultiCacheByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = pageInfo.Total
	var updatedByList []string
	for _, template := range list {
		updatedByList = append(updatedByList, template.UpdatedBy)
	}
	adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, updatedByList)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, evaluationTemplateInfo := range list {
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
		resp.List = append(resp.List, &pb.EvaluationTemplateInfo{
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
		})
	}
	return resp, nil
}
