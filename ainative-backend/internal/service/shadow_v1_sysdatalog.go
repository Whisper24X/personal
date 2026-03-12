package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1SysDataLogService(
	logger log.Logger,
	shadowV1SysDataLogUseCase *biz.ShadowV1SysDataLogUseCase,
) *ShadowV1SysDataLogService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1SysDataLog"), log.WithMessageKey("message"))
	return &ShadowV1SysDataLogService{
		log:                       l,
		shadowV1SysDataLogUseCase: shadowV1SysDataLogUseCase,
	}
}

type ShadowV1SysDataLogService struct {
	pb.UnimplementedSysDataLogServer
	log                       *log.Helper
	shadowV1SysDataLogUseCase *biz.ShadowV1SysDataLogUseCase
}

// GetSysDataLogList 系统-数据日志-列表数据查询
func (s *ShadowV1SysDataLogService) GetSysDataLogList(ctx context.Context, req *pb.GetSysDataLogListReq) (*pb.GetSysDataLogListReply, error) {
	return s.shadowV1SysDataLogUseCase.GetSysDataLogList(ctx, req)
}
