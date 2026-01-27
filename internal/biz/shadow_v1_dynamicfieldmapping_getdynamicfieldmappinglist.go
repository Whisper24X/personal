package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetDynamicFieldMappingList 动态字段映射关系表-列表数据查询
func (s *ShadowV1DynamicFieldMappingUseCase) GetDynamicFieldMappingList(ctx context.Context, req *pb.GetDynamicFieldMappingListReq) (*pb.GetDynamicFieldMappingListReply, error) {
	resp := &pb.GetDynamicFieldMappingListReply{}
	list, reply, err := s.dynamicFieldMappingRepo.QueryDynamicFieldMappingList(ctx, req)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = reply.Total
	for _, item := range list {
		mappingInfo, err := s.dynamicFieldMappingRepo.DTOShadowDynamicFieldMapping(item)
		if err != nil {
			return resp, err
		}
		resp.List = append(resp.List, mappingInfo)
	}
	return resp, nil
}
