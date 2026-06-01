package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// DeleteUserMessage 用户-消息-删除多条数据
func (s *ShadowV1UserMessageUseCase) DeleteUserMessage(ctx context.Context, req *pb.DeleteUserMessageReq) (*pb.DeleteUserMessageReply, error) {
	resp := &pb.DeleteUserMessageReply{}
	return resp, nil
}
