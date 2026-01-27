package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1UserService(
	logger log.Logger,
	shadowV1UserUseCase *biz.ShadowV1UserUseCase,
) *ShadowV1UserService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1User"), log.WithMessageKey("message"))
	return &ShadowV1UserService{
		log:                 l,
		shadowV1UserUseCase: shadowV1UserUseCase,
	}
}

type ShadowV1UserService struct {
	pb.UnimplementedUserServer
	log                 *log.Helper
	shadowV1UserUseCase *biz.ShadowV1UserUseCase
}

// GetUserList 用户-列表数据查询
func (s *ShadowV1UserService) GetUserList(ctx context.Context, req *pb.GetUserListReq) (*pb.GetUserListReply, error) {
	return s.shadowV1UserUseCase.GetUserList(ctx, req)
}

// GetUserInfo 用户-详情数据查询
func (s *ShadowV1UserService) GetUserInfo(ctx context.Context, req *pb.GetUserInfoReq) (*pb.GetUserInfoReply, error) {
	return s.shadowV1UserUseCase.GetUserInfo(ctx, req)
}

// DeleteUser 用户-删除账号
func (s *ShadowV1UserService) DeleteUser(ctx context.Context, req *pb.DeleteUserReq) (*pb.DeleteUserReply, error) {
	return s.shadowV1UserUseCase.DeleteUser(ctx, req)
}

// UnbindUserWx 用户-解绑微信
func (s *ShadowV1UserService) UnbindUserWx(ctx context.Context, req *pb.UnbindUserWxReq) (*pb.UnbindUserWxReply, error) {
	return s.shadowV1UserUseCase.UnbindUserWx(ctx, req)
}

// UpdateUserStatus 用户-修改状态
func (s *ShadowV1UserService) UpdateUserStatus(ctx context.Context, req *pb.UpdateUserStatusReq) (*pb.UpdateUserStatusReply, error) {
	return s.shadowV1UserUseCase.UpdateUserStatus(ctx, req)
}
