package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// QuerySearchRecordList 查询搜题记录列表
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) QuerySearchRecordList(ctx context.Context, req *pb.QuerySearchRecordListRequest) (*pb.QuerySearchRecordListReply, error) {
	resp := &pb.QuerySearchRecordListReply{}
	return resp, nil
}
