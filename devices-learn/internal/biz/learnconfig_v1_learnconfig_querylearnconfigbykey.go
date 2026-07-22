package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/learn_config/v1"
)

// QueryLearnConfigByKey 通过key查询学习配置
func (l *LearnConfigV1LearnConfigUseCase) QueryLearnConfigByKey(ctx context.Context, req *pb.QueryLearnConfigByKeyReq) (*pb.QueryLearnConfigByKeyReply, error) {
	resp := &pb.QueryLearnConfigByKeyReply{}
	return resp, nil
}
