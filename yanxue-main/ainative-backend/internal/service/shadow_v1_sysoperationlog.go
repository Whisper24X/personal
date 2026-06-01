package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1SysOperationLogService(
	logger log.Logger,
	shadowV1SysOperationLogUseCase *biz.ShadowV1SysOperationLogUseCase,
) *ShadowV1SysOperationLogService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1SysOperationLog"), log.WithMessageKey("message"))
	return &ShadowV1SysOperationLogService{
		log:                            l,
		shadowV1SysOperationLogUseCase: shadowV1SysOperationLogUseCase,
	}
}

type ShadowV1SysOperationLogService struct {
	pb.UnimplementedSysOperationLogServer
	log                            *log.Helper
	shadowV1SysOperationLogUseCase *biz.ShadowV1SysOperationLogUseCase
}

// SysOperationLogList 操作日志-列表
func (s *ShadowV1SysOperationLogService) SysOperationLogList(ctx context.Context, req *pb.SysOperationLogListReq) (*pb.SysOperationLogListResp, error) {
	return s.shadowV1SysOperationLogUseCase.SysOperationLogList(ctx, req)
}

// SysOperationLogStore 操作日志-保存
func (s *ShadowV1SysOperationLogService) SysOperationLogStore(ctx context.Context, req *pb.SysOperationLogStoreReq) (*pb.SysOperationLogStoreResp, error) {
	return s.shadowV1SysOperationLogUseCase.SysOperationLogStore(ctx, req)
}
