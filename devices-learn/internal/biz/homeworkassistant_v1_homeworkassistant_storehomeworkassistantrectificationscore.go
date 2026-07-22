package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// StoreHomeworkAssistantRectificationScore 作业助手积分-订正
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) StoreHomeworkAssistantRectificationScore(ctx context.Context, req *pb.StoreHomeworkAssistantRectificationScoreRequest) (*pb.StoreHomeworkAssistantRectificationScoreReply, error) {
	resp := &pb.StoreHomeworkAssistantRectificationScoreReply{}
	return resp, nil
}
