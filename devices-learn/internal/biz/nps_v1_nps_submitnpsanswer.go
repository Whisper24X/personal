package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
)

// SubmitNpsAnswer 用户弹窗答案提交
func (n *NpsV1NpsUseCase) SubmitNpsAnswer(ctx context.Context, req *pb.SubmitNpsAnswerRequest) (*pb.SubmitNpsAnswerReply, error) {
	resp := &pb.SubmitNpsAnswerReply{}
	return resp, nil
}
