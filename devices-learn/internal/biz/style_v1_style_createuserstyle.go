package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/style/v1"
)

// CreateUserStyle 创建用户学习风格
func (s *StyleV1StyleUseCase) CreateUserStyle(ctx context.Context, req *pb.CreateUserStyleRequest) (*pb.UserStyleInfo, error) {
	resp := &pb.UserStyleInfo{}
	return resp, nil
}
