package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_dock_config/v1"
)

// QueryDynamicDockConfigListShadowV2 查询动态dock配置列表(v2)
func (d *DynamicDockConfigV1DynamicDockConfigUseCase) QueryDynamicDockConfigListShadowV2(ctx context.Context, req *pb.QueryDynamicDockConfigListShadowReq) (*pb.QueryDynamicDockConfigListShadowReply, error) {
	resp := &pb.QueryDynamicDockConfigListShadowReply{}
	return resp, nil
}
