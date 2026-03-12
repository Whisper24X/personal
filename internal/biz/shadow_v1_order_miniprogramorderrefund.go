package biz

import (
	"context"
	"net/http"
	"os"

	"github.com/go-kratos/kratos/v2/errors"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// MiniProgramOrderRefund 小程序订单退款
func (s *ShadowV1OrderUseCase) MiniProgramOrderRefund(ctx context.Context, req *pb.MiniProgramOrderRefundReq) (*pb.MiniProgramOrderRefundReply, error) {
	resp := &pb.MiniProgramOrderRefundReply{}
	adminId := meta.GetAdminID(ctx)
	orderInfo, err := s.orderRepo.FindOneCacheByID(ctx, req.GetOrderId())
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	if orderInfo.ID == "" {
		return resp, errors.New(http.StatusBadRequest, "-1", "订单不存在！")
	}
	if orderInfo.Status != string(constant.OrderStatusPending) &&
		orderInfo.Status != string(constant.OrderStatusSuccess) &&
		orderInfo.Status != string(constant.OrderStatusCompleted) {
		return resp, errors.New(http.StatusBadRequest, "-1", "当前订单状态不允许退款")
	}
	totalAmount := int(orderInfo.OrderPrice * 100) // 单位为分
	refundAmount := int(req.GetRefundAmount())     // 前端传的是分，直接使用
	// 如果是测试环境，只退一分钱
	if (os.Getenv("GO_ENV") == "test" || os.Getenv("GO_ENV") == "development") &&
		totalAmount > 1000 {
		totalAmount = 1
		refundAmount = 1
	}
	s.log.Infof("MiniProgramOrderRefund WechatPayRefund params: payId=%s, orderId32=%s, totalAmount=%d, refundAmount=%d, refundReason=%s",
		orderInfo.PayID,
		UUIDTo32String(orderInfo.ID),
		totalAmount,
		refundAmount,
		req.GetRefundReason(),
	)
	refundId, err := s.wechatPayRepo.WechatPayRefund(ctx, orderInfo.PayID, UUIDTo32String(orderInfo.ID), totalAmount, refundAmount, req.GetRefundReason())
	if err != nil {
		s.log.Errorf("MiniProgramOrderRefund refund err: %v, orderId: %s", err, orderInfo.ID)
		return resp, errorx.APIThirdErr.WithError(err).Err()
	}
	if refundId == "" {
		s.log.Errorf("MiniProgramOrderRefund refundId is empty, orderId: %s", orderInfo.ID)
		return resp, errors.New(http.StatusConflict, "-1", "退款失败，请稍后重试！")
	}
	oldOrderInfo := s.orderRepo.DeepCopy(orderInfo)
	orderInfo.RefundID = refundId
	orderInfo.RefundAmount = int32(refundAmount)
	orderInfo.Status = string(constant.OrderStatusRefunding)
	orderInfo.RefundReason = req.GetRefundReason()
	orderInfo.RefundTime = timeutil.Carbon().Now().ToStdTime()
	err = s.orderRepo.UpdateOneCache(ctx, orderInfo, oldOrderInfo)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	// 写操作日志
	operationType := constant.OperationTypeOrderRefund
	newData, _ := jsonutil.Marshal(orderInfo)
	oldData, _ := jsonutil.Marshal(oldOrderInfo)
	_ = s.sysDataLogRepo.CreateOneCache(ctx, &yanxue_model.SysDataLog{
		OperationType: operationType,
		OperatorID:    req.GetOrderId(),
		OldData:       oldData,
		NewData:       newData,
		UpdatedBy:     adminId,
		Module:        constant.ModuleTypeOrder,
		Remark:        req.GetRefundReason(),
	})

	// 如果还有已预约的课程，需要发送飞书通知
	courseAppointmentList, err := s.courseAppointmentRepo.FindMultiByOrderID(ctx, orderInfo.ID)
	if err != nil {
		s.log.Errorf("发送退款飞书消息，查询课程预约失败,订单ID：%s", orderInfo.ID)
	}
	isNeedSendFeiShuRefundNotice := false
	for _, appointment := range courseAppointmentList {
		if appointment.Status == string(constant.CourseAppointmentStatusSuccess) {
			isNeedSendFeiShuRefundNotice = true
		}
	}
	if isNeedSendFeiShuRefundNotice {
		// 发送飞书通知：有退款订单，需要手动取消预约
		s.orderRepo.SendRefundCancelAppointmentFeiShuNotify(ctx, orderInfo.OrderNumber)
	}

	return resp, nil
}
