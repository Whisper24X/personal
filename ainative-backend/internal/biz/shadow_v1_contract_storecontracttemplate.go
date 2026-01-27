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
	"gorm.io/datatypes"
)

// StoreContractTemplate 添加合同模版（有则更新，无则新增）
func (s *ShadowV1ContractUseCase) StoreContractTemplate(ctx context.Context, req *pb.StoreContractTemplateReq) (*pb.StoreContractTemplateReply, error) {
	resp := &pb.StoreContractTemplateReply{}
	adminId := meta.GetAdminID(ctx)
	// 新增
	if req.GetId() == "" {
		contractTemplate := &yanxue_model.ContractTemplate{
			TemplateType: int16(req.GetTemplateType()),
			TemplateName: req.GetTemplateName(),
			TemplateURL:  req.GetTemplateUrl(),
			Status:       constant.TemplateValidStatus,
			UpdatedBy:    adminId,
		}
		err := s.contractTemplateRepo.CreateOneCache(ctx, contractTemplate)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		// 写操作日志
		newData, _ := jsonutil.Marshal(req)
		_ = s.sysDataLogRepo.CreateOneCache(ctx, &yanxue_model.SysDataLog{
			OperationType: constant.OperationTypeAddNewTemplate,
			OperatorID:    contractTemplate.ID,
			OldData:       datatypes.JSON{},
			NewData:       newData,
			UpdatedBy:     adminId,
			Module:        constant.ModuleTypeContractTemplate,
		})
		resp.Id = contractTemplate.ID
	} else { // 更新
		contractTemplate, err := s.contractTemplateRepo.FindOneCacheByID(ctx, req.GetId())
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		if contractTemplate.ID == "" {
			return resp, errorx.DataSQLErr.WithError(errors.New("合同模版不存在")).Err()
		}
		oldContractTemplate := s.contractTemplateRepo.DeepCopy(contractTemplate)
		contractTemplate.TemplateType = int16(req.GetTemplateType())
		contractTemplate.TemplateName = req.GetTemplateName()
		contractTemplate.TemplateURL = req.GetTemplateUrl()
		contractTemplate.UpdatedBy = adminId
		err = s.contractTemplateRepo.UpdateOneCacheWithZero(ctx, contractTemplate, oldContractTemplate)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		// 写操作日志
		newData, _ := jsonutil.Marshal(contractTemplate)
		oldData, _ := jsonutil.Marshal(oldContractTemplate)
		_ = s.sysDataLogRepo.CreateOneCache(ctx, &yanxue_model.SysDataLog{
			OperationType: constant.OperationTypeUpdateTemplate,
			OperatorID:    contractTemplate.ID,
			NewData:       newData,
			OldData:       oldData,
			UpdatedBy:     adminId,
			Module:        constant.ModuleTypeContractTemplate,
		})
		resp.Id = contractTemplate.ID
	}
	return resp, nil
}
