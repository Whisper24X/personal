package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// SearchQuestion 搜题
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) SearchQuestion(ctx context.Context, req *pb.SearchQuestionRequest) (*pb.SearchQuestionReply, error) {
	resp := &pb.SearchQuestionReply{}
	return resp, nil
}
