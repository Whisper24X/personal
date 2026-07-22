package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/target/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewTargetV1TargetService(
	logger log.Logger,
	targetV1TargetUseCase *biz.TargetV1TargetUseCase,
) *TargetV1TargetService {
	l := log.NewHelper(log.With(logger, "module", "service/targetV1Target"), log.WithMessageKey("message"))
	return &TargetV1TargetService{
		log:                   l,
		targetV1TargetUseCase: targetV1TargetUseCase,
	}
}

type TargetV1TargetService struct {
	pb.UnimplementedTargetServer
	log                   *log.Helper
	targetV1TargetUseCase *biz.TargetV1TargetUseCase
}

// GetSchoolScoresTotalSubject 查询学校各科满分分数选项
func (t *TargetV1TargetService) GetSchoolScoresTotalSubject(ctx context.Context, req *pb.GetSchoolScoresTotalSubjectRequest) (*pb.GetSchoolScoresTotalSubjectReply, error) {
	return t.targetV1TargetUseCase.GetSchoolScoresTotalSubject(ctx, req)
}

// CreateUserLearnTarget 创建用户学习目标
func (t *TargetV1TargetService) CreateUserLearnTarget(ctx context.Context, req *pb.CreateUserLearnTargetRequest) (*pb.UserLearnTargetInfo, error) {
	return t.targetV1TargetUseCase.CreateUserLearnTarget(ctx, req)
}

// GetUserLearnTarget 查询用户学习目标
func (t *TargetV1TargetService) GetUserLearnTarget(ctx context.Context, req *pb.GetUserLearnTargetRequest) (*pb.UserLearnTargetInfo, error) {
	return t.targetV1TargetUseCase.GetUserLearnTarget(ctx, req)
}
