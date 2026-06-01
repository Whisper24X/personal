package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// QueryTopicList 查询主题列表
func (s *ShadowV1ContractUseCase) QueryTopicList(ctx context.Context, req *pb.QueryTopicListReq) (*pb.QueryTopicListReply, error) {
	resp := &pb.QueryTopicListReply{}
	templateList, _, err := s.contractTemplateRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, template := range templateList {
		// 过滤掉无效状态的主题
		if template.Status != constant.TemplateInvalidStatus {
			resp.List = append(resp.List, template.TemplateName)
		}
	}
	return resp, nil
}
