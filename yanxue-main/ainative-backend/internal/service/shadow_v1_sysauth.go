package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1SysAuthService(
	logger log.Logger,
	shadowV1SysAuthUseCase *biz.ShadowV1SysAuthUseCase,
) *ShadowV1SysAuthService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1SysAuth"), log.WithMessageKey("message"))
	return &ShadowV1SysAuthService{
		log:                    l,
		shadowV1SysAuthUseCase: shadowV1SysAuthUseCase,
	}
}

type ShadowV1SysAuthService struct {
	pb.UnimplementedSysAuthServer
	log                    *log.Helper
	shadowV1SysAuthUseCase *biz.ShadowV1SysAuthUseCase
}

// SysAuthLogin Auth-登录
func (s *ShadowV1SysAuthService) SysAuthLogin(ctx context.Context, req *pb.SysAuthLoginReq) (*pb.SysAuthLoginReply, error) {
	return s.shadowV1SysAuthUseCase.SysAuthLogin(ctx, req)
}

// SysAuthLogout Auth-退出
func (s *ShadowV1SysAuthService) SysAuthLogout(ctx context.Context, req *pb.SysAuthLogoutReq) (*pb.SysAuthLogoutReply, error) {
	return s.shadowV1SysAuthUseCase.SysAuthLogout(ctx, req)
}

// SysAuthCheckToken Auth-检查token
func (s *ShadowV1SysAuthService) SysAuthCheckToken(ctx context.Context, req *pb.SysAuthCheckTokenReq) (*pb.SysAuthCheckTokenReply, error) {
	return s.shadowV1SysAuthUseCase.SysAuthCheckToken(ctx, req)
}
