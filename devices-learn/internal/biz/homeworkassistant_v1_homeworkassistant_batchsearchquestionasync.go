package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// BatchSearchQuestionAsync 异步批量搜题
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) BatchSearchQuestionAsync(ctx context.Context, req *pb.BatchSearchQuestionRequest) (*pb.BatchSearchQuestionReply, error) {
	resp := &pb.BatchSearchQuestionReply{}
	return resp, nil
}
