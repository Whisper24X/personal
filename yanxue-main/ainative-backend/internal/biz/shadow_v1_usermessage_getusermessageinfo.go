package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
)

// GetUserMessageInfo 用户-消息-单条数据查询
func (s *ShadowV1UserMessageUseCase) GetUserMessageInfo(ctx context.Context, req *pb.GetUserMessageInfoReq) (*pb.GetUserMessageInfoReply, error) {
	resp := &pb.GetUserMessageInfoReply{}
	return resp, nil
}
