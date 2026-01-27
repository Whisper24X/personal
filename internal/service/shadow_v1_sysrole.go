package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1SysRoleService(
	logger log.Logger,
	shadowV1SysRoleUseCase *biz.ShadowV1SysRoleUseCase,
) *ShadowV1SysRoleService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1SysRole"), log.WithMessageKey("message"))
	return &ShadowV1SysRoleService{
		log:                    l,
		shadowV1SysRoleUseCase: shadowV1SysRoleUseCase,
	}
}

type ShadowV1SysRoleService struct {
	pb.UnimplementedSysRoleServer
	log                    *log.Helper
	shadowV1SysRoleUseCase *biz.ShadowV1SysRoleUseCase
}

// SysRoleList 角色-列表
func (s *ShadowV1SysRoleService) SysRoleList(ctx context.Context, req *pb.SysRoleListReq) (*pb.SysRoleListResp, error) {
	return s.shadowV1SysRoleUseCase.SysRoleList(ctx, req)
}

// SysRoleStore 角色-保存角色
func (s *ShadowV1SysRoleService) SysRoleStore(ctx context.Context, req *pb.SysRoleStoreReq) (*pb.SysRoleStoreResp, error) {
	return s.shadowV1SysRoleUseCase.SysRoleStore(ctx, req)
}

// SysRoleDel 角色-删除角色
func (s *ShadowV1SysRoleService) SysRoleDel(ctx context.Context, req *pb.SysRoleDelReq) (*pb.SysRoleDelResp, error) {
	return s.shadowV1SysRoleUseCase.SysRoleDel(ctx, req)
}

// SysRoleStatus 角色-修改状态
func (s *ShadowV1SysRoleService) SysRoleStatus(ctx context.Context, req *pb.SysRoleStatusReq) (*pb.SysRoleStatusResp, error) {
	return s.shadowV1SysRoleUseCase.SysRoleStatus(ctx, req)
}

// SysRoleSelect 角色-下拉选择列表
func (s *ShadowV1SysRoleService) SysRoleSelect(ctx context.Context, req *pb.SysRoleSelectReq) (*pb.SysRoleSelectResp, error) {
	return s.shadowV1SysRoleUseCase.SysRoleSelect(ctx, req)
}
