package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1SysDeptService(
	logger log.Logger,
	shadowV1SysDeptUseCase *biz.ShadowV1SysDeptUseCase,
) *ShadowV1SysDeptService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1SysDept"), log.WithMessageKey("message"))
	return &ShadowV1SysDeptService{
		log:                    l,
		shadowV1SysDeptUseCase: shadowV1SysDeptUseCase,
	}
}

type ShadowV1SysDeptService struct {
	pb.UnimplementedSysDeptServer
	log                    *log.Helper
	shadowV1SysDeptUseCase *biz.ShadowV1SysDeptUseCase
}

// SysDeptList 部门-列表
func (s *ShadowV1SysDeptService) SysDeptList(ctx context.Context, req *pb.SysDeptListReq) (*pb.SysDeptListResp, error) {
	return s.shadowV1SysDeptUseCase.SysDeptList(ctx, req)
}

// SysDeptStore 部门-保存
func (s *ShadowV1SysDeptService) SysDeptStore(ctx context.Context, req *pb.SysDeptStoreReq) (*pb.SysDeptStoreResp, error) {
	return s.shadowV1SysDeptUseCase.SysDeptStore(ctx, req)
}

// SysDeptDel 部门-删除
func (s *ShadowV1SysDeptService) SysDeptDel(ctx context.Context, req *pb.SysDeptDelReq) (*pb.SysDeptDelResp, error) {
	return s.shadowV1SysDeptUseCase.SysDeptDel(ctx, req)
}

// SysDeptStatus 部门-修改权限状态
func (s *ShadowV1SysDeptService) SysDeptStatus(ctx context.Context, req *pb.SysDeptStatusReq) (*pb.SysDeptStatusResp, error) {
	return s.shadowV1SysDeptUseCase.SysDeptStatus(ctx, req)
}
