package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/style/v1"
)

// GetUserStyle 查询用户学习风格
func (s *StyleV1StyleUseCase) GetUserStyle(ctx context.Context, req *pb.GetUserStyleRequest) (*pb.UserStyleInfo, error) {
	resp := &pb.UserStyleInfo{}
	return resp, nil
}
