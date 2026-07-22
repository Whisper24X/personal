package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
)

// RegisterSearchDevices 注册设备
func (h *HomeworkAssistantV1HomeworkAssistantUseCase) RegisterSearchDevices(ctx context.Context, req *pb.RegisterSearchDevicesRequest) (*pb.RegisterSearchDevicesReply, error) {
	resp := &pb.RegisterSearchDevicesReply{}
	return resp, nil
}
