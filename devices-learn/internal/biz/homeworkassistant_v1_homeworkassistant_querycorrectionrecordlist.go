package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QueryCorrectionRecordList 查询批改记录列表（压测）
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QueryCorrectionRecordList(ctx context.Context, req *pb.QueryCorrectionRecordListRequest) (*pb.QueryCorrectionRecordListReply, error) {
	resp := &pb.QueryCorrectionRecordListReply{}
	return resp, nil
}
