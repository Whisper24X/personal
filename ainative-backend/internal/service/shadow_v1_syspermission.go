package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1SysPermissionService(
	logger log.Logger,
	shadowV1SysPermissionUseCase *biz.ShadowV1SysPermissionUseCase,
) *ShadowV1SysPermissionService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1SysPermission"), log.WithMessageKey("message"))
	return &ShadowV1SysPermissionService{
		log:                          l,
		shadowV1SysPermissionUseCase: shadowV1SysPermissionUseCase,
	}
}

type ShadowV1SysPermissionService struct {
	pb.UnimplementedSysPermissionServer
	log                          *log.Helper
	shadowV1SysPermissionUseCase *biz.ShadowV1SysPermissionUseCase
}

// SysPermissionList 功能权限-列表
func (s *ShadowV1SysPermissionService) SysPermissionList(ctx context.Context, req *pb.SysPermissionListReq) (*pb.SysPermissionListResp, error) {
	return s.shadowV1SysPermissionUseCase.SysPermissionList(ctx, req)
}

// SysPermissionStore 功能权限-保存
func (s *ShadowV1SysPermissionService) SysPermissionStore(ctx context.Context, req *pb.SysPermissionStoreReq) (*pb.SysPermissionStoreResp, error) {
	return s.shadowV1SysPermissionUseCase.SysPermissionStore(ctx, req)
}

// SysPermissionDel 功能权限-删除
func (s *ShadowV1SysPermissionService) SysPermissionDel(ctx context.Context, req *pb.SysPermissionDelReq) (*pb.SysPermissionDelResp, error) {
	return s.shadowV1SysPermissionUseCase.SysPermissionDel(ctx, req)
}

// SysPermissionStatus 功能权限-修改权限状态
func (s *ShadowV1SysPermissionService) SysPermissionStatus(ctx context.Context, req *pb.SysPermissionStatusReq) (*pb.SysPermissionStatusResp, error) {
	return s.shadowV1SysPermissionUseCase.SysPermissionStatus(ctx, req)
}
