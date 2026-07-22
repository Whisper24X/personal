package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/user/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewUserV1UserService(
	logger log.Logger,
	userV1UserUseCase *biz.UserV1UserUseCase,
) *UserV1UserService {
	l := log.NewHelper(log.With(logger, "module", "service/userV1User"), log.WithMessageKey("message"))
	return &UserV1UserService{
		log:               l,
		userV1UserUseCase: userV1UserUseCase,
	}
}

type UserV1UserService struct {
	pb.UnimplementedUserServer
	log               *log.Helper
	userV1UserUseCase *biz.UserV1UserUseCase
}

// QueryIfUserCanRenewal 查询用户是否能够续购
func (u *UserV1UserService) QueryIfUserCanRenewal(ctx context.Context, req *pb.QueryIfUserCanRenewalReq) (*pb.QueryIfUserCanRenewalReply, error) {
	return u.userV1UserUseCase.QueryIfUserCanRenewal(ctx, req)
}

// QueryScholarBasicInfo 查询用户学霸之魂基础信息
func (u *UserV1UserService) QueryScholarBasicInfo(ctx context.Context, req *pb.QueryScholarBasicInfoReq) (*pb.QueryScholarBasicInfoReply, error) {
	return u.userV1UserUseCase.QueryScholarBasicInfo(ctx, req)
}
