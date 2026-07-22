package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/user/v1"
)

// QueryScholarBasicInfo 查询用户学霸之魂基础信息
func (u *UserV1UserUseCase) QueryScholarBasicInfo(ctx context.Context, req *pb.QueryScholarBasicInfoReq) (*pb.QueryScholarBasicInfoReply, error) {
	resp := &pb.QueryScholarBasicInfoReply{}
	return resp, nil
}
