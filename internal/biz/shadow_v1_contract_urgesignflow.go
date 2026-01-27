package biz

import (
	"context"
	"fmt"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
)

// UrgeSignFlow 催签流程中签署人
func (s *ShadowV1ContractUseCase) UrgeSignFlow(ctx context.Context, req *pb.UrgeSignFlowReq) (*pb.UrgeSignFlowReply, error) {
	resp := &pb.UrgeSignFlowReply{}
	contractStatus, err := s.eSignRepo.GetSignFlowDetail(ctx, req.GetSignFlowId())
	if err != nil {
		return resp, errors.New(http.StatusConflict, "-1", fmt.Sprintf("查询合同状态失败！: %s", err.Error()))
	}
	if contractStatus != constant.ContractStatusSigning {
		return resp, errors.New(http.StatusConflict, "-1", "只有状态为签署中的合同允许催签！")
	}
	isSucceed, err := s.eSignRepo.UrgeSignFlow(ctx, req.GetSignFlowId(), req.GetPsnAccount())
	if err != nil {
		return resp, errors.New(http.StatusConflict, "-1", err.Error())
	}
	resp.IsSucceed = isSucceed
	return resp, nil
}
