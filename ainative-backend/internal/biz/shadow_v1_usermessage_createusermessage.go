package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// CreateUserMessage 用户-消息-创建一条数据
func (s *ShadowV1UserMessageUseCase) CreateUserMessage(ctx context.Context, req *pb.CreateUserMessageReq) (*pb.CreateUserMessageReply, error) {
	resp := &pb.CreateUserMessageReply{}
	return resp, nil
}
