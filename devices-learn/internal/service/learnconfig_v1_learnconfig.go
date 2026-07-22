package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/learn_config/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewLearnConfigV1LearnConfigService(
	logger log.Logger,
	learnConfigV1LearnConfigUseCase *biz.LearnConfigV1LearnConfigUseCase,
) *LearnConfigV1LearnConfigService {
	l := log.NewHelper(log.With(logger, "module", "service/learnConfigV1LearnConfig"), log.WithMessageKey("message"))
	return &LearnConfigV1LearnConfigService{
		log:                             l,
		learnConfigV1LearnConfigUseCase: learnConfigV1LearnConfigUseCase,
	}
}

type LearnConfigV1LearnConfigService struct {
	pb.UnimplementedLearnConfigServer
	log                             *log.Helper
	learnConfigV1LearnConfigUseCase *biz.LearnConfigV1LearnConfigUseCase
}

// ParseLearnConfigCsvFile 解析学习配置csv文件
func (l *LearnConfigV1LearnConfigService) ParseLearnConfigCsvFile(ctx context.Context, req *pb.ParseLearnConfigCsvFileReq) (*pb.ParseLearnConfigCsvFileReply, error) {
	return l.learnConfigV1LearnConfigUseCase.ParseLearnConfigCsvFile(ctx, req)
}

// StoreLearnConfig 保存学习配置
func (l *LearnConfigV1LearnConfigService) StoreLearnConfig(ctx context.Context, req *pb.StoreLearnConfigReq) (*pb.StoreLearnConfigReply, error) {
	return l.learnConfigV1LearnConfigUseCase.StoreLearnConfig(ctx, req)
}

// QueryLearnConfigListShadow 查询学习配置列表
func (l *LearnConfigV1LearnConfigService) QueryLearnConfigListShadow(ctx context.Context, req *pb.QueryLearnConfigListShadowReq) (*pb.QueryLearnConfigListShadowReply, error) {
	return l.learnConfigV1LearnConfigUseCase.QueryLearnConfigListShadow(ctx, req)
}

// QueryLearnConfigByKey 通过key查询学习配置
func (l *LearnConfigV1LearnConfigService) QueryLearnConfigByKey(ctx context.Context, req *pb.QueryLearnConfigByKeyReq) (*pb.QueryLearnConfigByKeyReply, error) {
	return l.learnConfigV1LearnConfigUseCase.QueryLearnConfigByKey(ctx, req)
}

// UpdateLearnConfigStatus 更改学习配置状态
func (l *LearnConfigV1LearnConfigService) UpdateLearnConfigStatus(ctx context.Context, req *pb.UpdateLearnConfigStatusReq) (*pb.UpdateLearnConfigStatusReply, error) {
	return l.learnConfigV1LearnConfigUseCase.UpdateLearnConfigStatus(ctx, req)
}
