package biz

import (
	"context"
	"fmt"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
)

// RevokeSignFlow 撤销签署流程
func (s *ShadowV1ContractUseCase) RevokeSignFlow(ctx context.Context, req *pb.RevokeSignFlowReq) (*pb.RevokeSignFlowReply, error) {
	resp := &pb.RevokeSignFlowReply{}
	contractStatus, err := s.eSignRepo.GetSignFlowDetail(ctx, req.GetSignFlowId())
	if err != nil {
		return resp, errors.New(http.StatusConflict, "-1", fmt.Sprintf("查询合同状态失败！: %s", err.Error()))
	}
	if contractStatus != constant.ContractStatusSigning {
		return resp, errors.New(http.StatusConflict, "-1", "只有状态为签署中的合同允许撤销！")
	}
	isSucceed, err := s.eSignRepo.RevokeSignFlow(ctx, req.GetSignFlowId(), req.GetRevokeReason())
	if err != nil {
		return resp, errors.New(http.StatusConflict, "-1", err.Error())
	}
	// 撤销成功后，更新合同状态
	contractList, err := s.contractRecordRepo.FindMultiBySignFlowID(ctx, req.GetSignFlowId())
	if err != nil {
		return resp, errors.New(http.StatusConflict, "-1", fmt.Sprintf("查询合同失败！: %s", err.Error()))
	}
	if len(contractList) == 0 {
		return resp, errors.New(http.StatusConflict, "-1", "未找到对应的合同！")
	}
	contract := contractList[0]
	contract.ContractStatus = constant.ContractStatusRevoke
	err = s.contractRecordRepo.UpdateOne(ctx, contract)
	if err != nil {
		return resp, errors.New(http.StatusConflict, "-1", fmt.Sprintf("更新合同状态失败！: %s", err.Error()))
	}
	resp.IsSucceed = isSucceed
	return resp, nil
}
