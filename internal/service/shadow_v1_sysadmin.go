package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1SysAdminService(
	logger log.Logger,
	shadowV1SysAdminUseCase *biz.ShadowV1SysAdminUseCase,
) *ShadowV1SysAdminService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1SysAdmin"), log.WithMessageKey("message"))
	return &ShadowV1SysAdminService{
		log:                     l,
		shadowV1SysAdminUseCase: shadowV1SysAdminUseCase,
	}
}

type ShadowV1SysAdminService struct {
	pb.UnimplementedSysAdminServer
	log                     *log.Helper
	shadowV1SysAdminUseCase *biz.ShadowV1SysAdminUseCase
}

// SysAdminList 管理用户-列表
func (s *ShadowV1SysAdminService) SysAdminList(ctx context.Context, req *pb.SysAdminListReq) (*pb.SysAdminListReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminList(ctx, req)
}

// SysAdminStore 管理用户-保存管理员
func (s *ShadowV1SysAdminService) SysAdminStore(ctx context.Context, req *pb.SysAdminStoreReq) (*pb.SysAdminStoreReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminStore(ctx, req)
}

// SysAdminStatus 管理用户-修改状态
func (s *ShadowV1SysAdminService) SysAdminStatus(ctx context.Context, req *pb.SysAdminStatusReq) (*pb.SysAdminStatusReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminStatus(ctx, req)
}

// SysAdminChangePwd 管理用户-修改密码
func (s *ShadowV1SysAdminService) SysAdminChangePwd(ctx context.Context, req *pb.SysAdminChangePwdReq) (*pb.SysAdminChangePwdReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminChangePwd(ctx, req)
}

// SysAdminResetPwd 管理用户-密码重置
func (s *ShadowV1SysAdminService) SysAdminResetPwd(ctx context.Context, req *pb.SysAdminResetPwdReq) (*pb.SysAdminResetPwdReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminResetPwd(ctx, req)
}

// SysAdminDel 管理用户-删除管理员
func (s *ShadowV1SysAdminService) SysAdminDel(ctx context.Context, req *pb.SysAdminDelReq) (*pb.SysAdminDelReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminDel(ctx, req)
}

// SysAdminInfo 管理用户-获取当前登录管理员的信息
func (s *ShadowV1SysAdminService) SysAdminInfo(ctx context.Context, req *pb.SysAdminInfoReq) (*pb.SysAdminInfoReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminInfo(ctx, req)
}

// SysAdminPermission 管理用户-获取当前登录管理员的菜单权限数据
func (s *ShadowV1SysAdminService) SysAdminPermission(ctx context.Context, req *pb.SysAdminPermissionReq) (*pb.SysAdminPermissionReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminPermission(ctx, req)
}

// SysAdminDeptList 管理用户-获取当前登录管理员的可见部门数据
func (s *ShadowV1SysAdminService) SysAdminDeptList(ctx context.Context, req *pb.SysAdminDeptListReq) (*pb.SysAdminDeptListReply, error) {
	return s.shadowV1SysAdminUseCase.SysAdminDeptList(ctx, req)
}
