package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/user/v1"
)

// QueryIfUserCanRenewal 查询用户是否能够续购
func (u *UserV1UserUseCase) QueryIfUserCanRenewal(ctx context.Context, req *pb.QueryIfUserCanRenewalReq) (*pb.QueryIfUserCanRenewalReply, error) {
	resp := &pb.QueryIfUserCanRenewalReply{}
	return resp, nil
}
