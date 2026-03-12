package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1UserOperationLogService(
	logger log.Logger,
	shadowV1UserOperationLogUseCase *biz.ShadowV1UserOperationLogUseCase,
) *ShadowV1UserOperationLogService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1UserOperationLog"), log.WithMessageKey("message"))
	return &ShadowV1UserOperationLogService{
		log:                             l,
		shadowV1UserOperationLogUseCase: shadowV1UserOperationLogUseCase,
	}
}

type ShadowV1UserOperationLogService struct {
	pb.UnimplementedUserOperationLogServer
	log                             *log.Helper
	shadowV1UserOperationLogUseCase *biz.ShadowV1UserOperationLogUseCase
}

// CreateUserOperationLog 用户操作记录表-创建一条数据
func (s *ShadowV1UserOperationLogService) CreateUserOperationLog(ctx context.Context, req *pb.CreateUserOperationLogReq) (*pb.CreateUserOperationLogReply, error) {
	return s.shadowV1UserOperationLogUseCase.CreateUserOperationLog(ctx, req)
}

// UpdateUserOperationLog 用户操作记录表-更新一条数据
func (s *ShadowV1UserOperationLogService) UpdateUserOperationLog(ctx context.Context, req *pb.UpdateUserOperationLogReq) (*pb.UpdateUserOperationLogReply, error) {
	return s.shadowV1UserOperationLogUseCase.UpdateUserOperationLog(ctx, req)
}

// DeleteUserOperationLog 用户操作记录表-删除多条数据
func (s *ShadowV1UserOperationLogService) DeleteUserOperationLog(ctx context.Context, req *pb.DeleteUserOperationLogReq) (*pb.DeleteUserOperationLogReply, error) {
	return s.shadowV1UserOperationLogUseCase.DeleteUserOperationLog(ctx, req)
}

// GetUserOperationLogInfo 用户操作记录表-单条数据查询
func (s *ShadowV1UserOperationLogService) GetUserOperationLogInfo(ctx context.Context, req *pb.GetUserOperationLogInfoReq) (*pb.GetUserOperationLogInfoReply, error) {
	return s.shadowV1UserOperationLogUseCase.GetUserOperationLogInfo(ctx, req)
}

// GetUserOperationLogList 用户操作记录表-列表数据查询
func (s *ShadowV1UserOperationLogService) GetUserOperationLogList(ctx context.Context, req *pb.GetUserOperationLogListReq) (*pb.GetUserOperationLogListReply, error) {
	return s.shadowV1UserOperationLogUseCase.GetUserOperationLogList(ctx, req)
}
