package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
)

// QueryDouYinOrderCertificateInfo 查询抖音订单券ID信息
func (s *ShadowV1OrderUseCase) QueryDouYinOrderCertificateInfo(ctx context.Context, req *pb.QueryDouYinOrderCertificateInfoReq) (*pb.QueryDouYinOrderCertificateInfoReply, error) {
	resp := &pb.QueryDouYinOrderCertificateInfoReply{}

	// 参数校验
	if req.OrderId == "" {
		return resp, errorx.ParamErr.WithFmtMsg("订单ID不能为空").Err()
	}

	// 如果没有传 accountId，使用系统默认的
	accountId := req.AccountId
	if accountId == "" {
		accountId = constant.DouYinAccountId
	}

	// 调用抖音接口查询订单信息
	orderInfoReply, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
		AccountId: accountId,
		OrderId:   req.OrderId,
		PageNum:   1,
		PageSize:  100,
	})

	if err != nil {
		s.log.Errorf("QueryDouYinOrderCertificateInfo: 调用抖音接口失败, orderId=%s, err=%v", req.OrderId, err)
		return resp, errorx.APIInternalErr.WithError(err).Err()
	}

	// 检查是否查询到订单信息
	if len(orderInfoReply.Data.Orders) == 0 {
		s.log.Warnf("QueryDouYinOrderCertificateInfo: 未查询到订单信息, orderId=%s", req.OrderId)
		return resp, errorx.DataRecordNotFound.WithFmtMsg("未查询到订单信息").Err()
	}

	// 获取第一个订单（通常只有一个）
	orderInfo := orderInfoReply.Data.Orders[0]

	// 填充响应数据
	resp.OrderId = orderInfo.OrderId
	resp.OrderStatus = orderInfo.OrderStatus
	resp.SkuName = orderInfo.SkuName
	resp.SkuId = orderInfo.SkuId
	resp.Count = orderInfo.Count
	resp.ReceiptAmount = orderInfo.ReceiptAmount
	resp.DiscountAmount = orderInfo.DiscountAmount
	resp.AnchorId = orderInfo.AnchorId

	// 转换券信息
	resp.Certificates = make([]*pb.CertificateInfo, 0, len(orderInfo.Certificate))
	for _, cert := range orderInfo.Certificate {
		certInfo := &pb.CertificateInfo{
			CertificateId:  cert.CertificateId,
			CombinationId:  cert.CombinationId,
			ItemStatus:     int32(cert.ItemStatus),
			ItemUpdateTime: int32(cert.ItemUpdateTime),
			OrderItemId:    cert.OrderItemId,
			RefundAmount:   int32(cert.RefundAmount),
			RefundTime:     int32(cert.RefundTime),
		}
		resp.Certificates = append(resp.Certificates, certInfo)
	}

	s.log.Infof("QueryDouYinOrderCertificateInfo: 查询成功, orderId=%s, 券数量=%d", req.OrderId, len(resp.Certificates))

	return resp, nil
}
