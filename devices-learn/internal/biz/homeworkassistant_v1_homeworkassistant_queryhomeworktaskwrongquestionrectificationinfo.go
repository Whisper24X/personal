package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QueryHomeworkTaskWrongQuestionRectificationInfo 查询订正记录详情（压测）
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QueryHomeworkTaskWrongQuestionRectificationInfo(ctx context.Context, req *pb.RectificationInfoRequest) (*pb.RectificationInfoReply, error) {
	resp := &pb.RectificationInfoReply{}
	return resp, nil
}
