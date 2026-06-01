package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// UpdateUserMessage 用户-消息-更新一条数据
func (s *ShadowV1UserMessageUseCase) UpdateUserMessage(ctx context.Context, req *pb.UpdateUserMessageReq) (*pb.UpdateUserMessageReply, error) {
	resp := &pb.UpdateUserMessageReply{}
	return resp, nil
}
