package biz

import (
	"context"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// QueryContractTemplateList 查询合同模版列表
func (s *ShadowV1ContractUseCase) QueryContractTemplateList(ctx context.Context, req *pb.QueryContractTemplateListReq) (*pb.QueryContractTemplateListReply, error) {
	resp := &pb.QueryContractTemplateListReply{}
	var page, pageSize int32
	if req.GetPage() > 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() > 0 {
		pageSize = req.GetPageSize()
	}
	param := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}
	// 过滤掉已删除的模板（状态为 -1）
	param.Query = append(param.Query, &condition.QueryParam{
		Field: "status",
		Value: int32(constant.TemplateInvalidStatus),
		Exp:   condition.NEQ,
		Logic: condition.AND,
	})
	// 根据模版名称模糊查询
	if req.GetTemplateName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "templateName",
			Value: "%%" + req.GetTemplateName() + "%%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}

	templateList, reply, err := s.contractTemplateRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = reply.Total
	var operatorList []string
	for _, template := range templateList {
		if template.UpdatedBy != "" {
			operatorList = append(operatorList, template.UpdatedBy)
		}
	}

	operatorIdToNameMap, err := s.sysAdminRepo.AdminIdToName(ctx, operatorList)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	for _, template := range templateList {
		resp.List = append(resp.List, &pb.ContractTemplateItem{
			Id:            template.ID,
			TemplateType:  int32(template.TemplateType),
			TemplateName:  template.TemplateName,
			TemplateUrl:   template.TemplateURL,
			Status:        template.Status,
			CreatedAt:     template.CreatedAt.Format(time.RFC3339),
			UpdatedAt:     template.UpdatedAt.Format(time.RFC3339),
			UpdatedBy:     template.UpdatedBy,
			UpdatedByName: operatorIdToNameMap[template.UpdatedBy],
		})
	}
	return resp, nil
}
