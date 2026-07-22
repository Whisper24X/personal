package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_learn_config/v1"
)

// QueryDynamicLearnConfigShadowList 查询动态学习配置列表
func (d *DynamicLearnConfigV1DynamicLearnConfigUseCase) QueryDynamicLearnConfigShadowList(ctx context.Context, req *pb.QueryDynamicLearnConfigListShadowReq) (*pb.QueryDynamicLearnConfigListShadowReply, error) {
	resp := &pb.QueryDynamicLearnConfigListShadowReply{}
	return resp, nil
}
