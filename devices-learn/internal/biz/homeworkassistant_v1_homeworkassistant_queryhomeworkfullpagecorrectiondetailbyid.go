package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QueryHomeworkFullPageCorrectionDetailById 作业批改结果查询（压测）
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QueryHomeworkFullPageCorrectionDetailById(ctx context.Context, req *pb.FullPageCorrectionDetailRequest) (*pb.FullPageCorrectionDetailReply, error) {
	resp := &pb.FullPageCorrectionDetailReply{}
	return resp, nil
}
