package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// StoreWrongQuestionRectificationInfo 保存错题订正记录
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) StoreWrongQuestionRectificationInfo(ctx context.Context, req *pb.RectificationRequest) (*pb.RectificationReply, error) {
	resp := &pb.RectificationReply{}
	return resp, nil
}
