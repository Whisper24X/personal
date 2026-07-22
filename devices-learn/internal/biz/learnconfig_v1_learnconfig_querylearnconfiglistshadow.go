package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/learn_config/v1"
)

// QueryLearnConfigListShadow 查询学习配置列表
func (l *LearnConfigV1LearnConfigUseCase) QueryLearnConfigListShadow(ctx context.Context, req *pb.QueryLearnConfigListShadowReq) (*pb.QueryLearnConfigListShadowReply, error) {
	resp := &pb.QueryLearnConfigListShadowReply{}
	return resp, nil
}
