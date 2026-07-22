package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// HomeworkFullPageCorrection 作业批改(压测）
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) HomeworkFullPageCorrection(ctx context.Context, req *pb.FullPageCorrectionRequest) (*pb.FullPageCorrectionReply, error) {
	resp := &pb.FullPageCorrectionReply{}
	return resp, nil
}
