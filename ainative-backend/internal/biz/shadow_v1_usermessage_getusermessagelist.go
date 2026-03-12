package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// GetUserMessageList 用户-消息-列表数据查询
func (s *ShadowV1UserMessageUseCase) GetUserMessageList(ctx context.Context, req *pb.GetUserMessageListReq) (*pb.GetUserMessageListReply, error) {
	resp := &pb.GetUserMessageListReply{}
	return resp, nil
}
