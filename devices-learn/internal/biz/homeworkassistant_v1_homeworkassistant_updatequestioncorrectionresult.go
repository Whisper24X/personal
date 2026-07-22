package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// UpdateQuestionCorrectionResult 题目批改结果修改
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) UpdateQuestionCorrectionResult(ctx context.Context, req *pb.CorrectionResultRequest) (*pb.CorrectionResultReply, error) {
	resp := &pb.CorrectionResultReply{}
	return resp, nil
}
