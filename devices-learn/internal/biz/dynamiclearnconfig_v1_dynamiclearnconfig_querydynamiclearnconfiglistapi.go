package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/dynamic_learn_config/v1"
)

// QueryDynamicLearnConfigListApi 客户端查询动态配置列表
func (d *DynamicLearnConfigV1DynamicLearnConfigUseCase) QueryDynamicLearnConfigListApi(ctx context.Context, req *pb.QueryDynamicLearnConfigListApiReq) (*pb.QueryDynamicLearnConfigListApiReply, error) {
	resp := &pb.QueryDynamicLearnConfigListApiReply{}
	return resp, nil
}
