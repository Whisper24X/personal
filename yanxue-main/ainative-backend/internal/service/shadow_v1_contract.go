package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewShadowV1ContractService(
	logger log.Logger,
	shadowV1ContractUseCase *biz.ShadowV1ContractUseCase,
) *ShadowV1ContractService {
	l := log.NewHelper(log.With(logger, "module", "service/shadowV1Contract"), log.WithMessageKey("message"))
	return &ShadowV1ContractService{
		log:                     l,
		shadowV1ContractUseCase: shadowV1ContractUseCase,
	}
}

type ShadowV1ContractService struct {
	pb.UnimplementedContractServer
	log                     *log.Helper
	shadowV1ContractUseCase *biz.ShadowV1ContractUseCase
}

// SyncContractStatus 同步合同状态
func (s *ShadowV1ContractService) SyncContractStatus(ctx context.Context) error {
	return s.shadowV1ContractUseCase.SyncContractStatus(ctx)
}

// ImportContractUserInfoByCsvFile 导入创建合同的用户信息
func (s *ShadowV1ContractService) ImportContractUserInfoByCsvFile(ctx context.Context, req *pb.ImportContractUserInfoByCsvFileReq) (*pb.ImportContractUserInfoByCsvFileReply, error) {
	return s.shadowV1ContractUseCase.ImportContractUserInfoByCsvFile(ctx, req)
}

// UrgeSignFlow 催签流程中签署人
func (s *ShadowV1ContractService) UrgeSignFlow(ctx context.Context, req *pb.UrgeSignFlowReq) (*pb.UrgeSignFlowReply, error) {
	return s.shadowV1ContractUseCase.UrgeSignFlow(ctx, req)
}

// StoreContractTemplate 添加合同模版（有则更新，无则新增）
func (s *ShadowV1ContractService) StoreContractTemplate(ctx context.Context, req *pb.StoreContractTemplateReq) (*pb.StoreContractTemplateReply, error) {
	return s.shadowV1ContractUseCase.StoreContractTemplate(ctx, req)
}

// UpdateContractTemplateStatus 修改合同模版状态
func (s *ShadowV1ContractService) UpdateContractTemplateStatus(ctx context.Context, req *pb.UpdateContractTemplateStatusReq) (*pb.UpdateContractTemplateStatusReply, error) {
	return s.shadowV1ContractUseCase.UpdateContractTemplateStatus(ctx, req)
}

// QueryContractTemplateList 查询合同模版列表
func (s *ShadowV1ContractService) QueryContractTemplateList(ctx context.Context, req *pb.QueryContractTemplateListReq) (*pb.QueryContractTemplateListReply, error) {
	return s.shadowV1ContractUseCase.QueryContractTemplateList(ctx, req)
}

// RevokeSignFlow 撤销签署流程
func (s *ShadowV1ContractService) RevokeSignFlow(ctx context.Context, req *pb.RevokeSignFlowReq) (*pb.RevokeSignFlowReply, error) {
	return s.shadowV1ContractUseCase.RevokeSignFlow(ctx, req)
}

// QueryAsyncTaskResult 查询异步任务结果
func (s *ShadowV1ContractService) QueryAsyncTaskResult(ctx context.Context, req *pb.QueryAsyncTaskResultReq) (*pb.QueryAsyncTaskResultReply, error) {
	return s.shadowV1ContractUseCase.QueryAsyncTaskResult(ctx, req)
}

// QueryContractList 查询合同列表
func (s *ShadowV1ContractService) QueryContractList(ctx context.Context, req *pb.QueryContractListReq) (*pb.QueryContractListReply, error) {
	return s.shadowV1ContractUseCase.QueryContractList(ctx, req)
}

// QueryTopicList 查询主题列表
func (s *ShadowV1ContractService) QueryTopicList(ctx context.Context, req *pb.QueryTopicListReq) (*pb.QueryTopicListReply, error) {
	return s.shadowV1ContractUseCase.QueryTopicList(ctx, req)
}

// ExportContractList 导出合同列表
func (s *ShadowV1ContractService) ExportContractList(ctx context.Context, req *pb.ExportContractListReq) (*pb.ExportContractListReply, error) {
	return s.shadowV1ContractUseCase.ExportContractList(ctx, req)
}

// GenerateContractByUserInfo 生成合同
func (s *ShadowV1ContractService) GenerateContractByUserInfo(ctx context.Context, req *pb.GenerateContractByUserInfoReq) (*pb.GenerateContractByUserInfoReply, error) {
	return s.shadowV1ContractUseCase.GenerateContractByUserInfo(ctx, req)
}
