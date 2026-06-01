package biz

import (
	"context"

	"github.com/pkg/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// UpdateContractTemplateStatus 修改合同模版状态
func (s *ShadowV1ContractUseCase) UpdateContractTemplateStatus(ctx context.Context, req *pb.UpdateContractTemplateStatusReq) (*pb.UpdateContractTemplateStatusReply, error) {
	resp := &pb.UpdateContractTemplateStatusReply{}
	if req.GetStatus() != constant.TemplateInvalidStatus && req.GetStatus() != constant.TemplateValidStatus {
		return resp, errorx.ParamValidationErr.WithError(errors.New("状态不合法！")).Err()
	}
	contractTemplate, err := s.contractTemplateRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if contractTemplate.ID == "" {
		return resp, errorx.DataSQLErr.WithError(errors.New("合同模版不存在")).Err()
	}
	adminId := meta.GetAdminID(ctx)
	oldContractTemplate := s.contractTemplateRepo.DeepCopy(contractTemplate)
	contractTemplate.Status = req.GetStatus()
	contractTemplate.UpdatedBy = adminId
	err = s.contractTemplateRepo.UpdateOneCacheWithZero(ctx, contractTemplate, oldContractTemplate)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	// 写操作日志
	newData, _ := jsonutil.Marshal(contractTemplate)
	oldData, _ := jsonutil.Marshal(oldContractTemplate)
	_ = s.sysDataLogRepo.CreateOneCache(ctx, &yanxue_model.SysDataLog{
		OperationType: constant.OperationTypeChangeTemplateStatus,
		OperatorID:    contractTemplate.ID,
		NewData:       newData,
		OldData:       oldData,
		UpdatedBy:     adminId,
		Module:        constant.ModuleTypeContractTemplate,
	})
	resp.IsSucceed = true
	return resp, nil
}
