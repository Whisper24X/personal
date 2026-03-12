package biz

import (
	"context"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/fileutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

func (s *ShadowV1OrderUseCase) ExportContractCsv(ctx context.Context, orderList *pb.GetOrderListReply, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// 写入表头
	headers := []string{
		"渠道订单编号",
		"渠道商品ID",
		"商品名称",
		"商品类型",
		"购买渠道",
		"实付金额",
		"实收金额",
		"平台优惠",
		"支付优惠",
		"店铺优惠",
		"保险费",
		"达人佣金",
		"达人UID",
		"达人名称",
		"平台手续费",
		"联系方式",
		"支付时间",
		"结算时间",
		"服务状态",
		"订单状态",
		"退款金额",
		"退款时间",
		"创建时间",
		"更新时间",
		"订单编号",
		"商品ID",
		"最后编辑人",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	// 写入数据
	for _, v := range orderList.List {
		// 格式化金额（分转元）
		orderPriceYuan := float32(v.OrderPrice) / 100.0
		receiptAmountYuan := float32(v.ReceiptAmount) / 100.0
		platformDiscountAmountYuan := float32(v.PlatformDiscountAmount) / 100.0
		paymentDiscountAmountYuan := float32(v.PaymentDiscountAmount) / 100.0
		shopDiscountAmountYuan := float32(v.ShopDiscountAmount) / 100.0
		actualInsuredYuan := float32(v.ActualInsured) / 100.0
		talentCommissionYuan := float32(v.TalentCommission) / 100.0
		platformFeeYuan := float32(v.PlatformFee) / 100.0
		refundAmountYuan := v.RefundAmount / 100.0

		// 格式化时间
		paymentTimeStr := ""
		if v.PaymentTime != "" {
			paymentTimeStr = timeutil.Carbon().Parse(v.PaymentTime).ToDateTimeString()
		}
		settlementTimeStr := ""
		if v.SettlementTime != "" {
			settlementTimeStr = timeutil.Carbon().Parse(v.SettlementTime).ToDateTimeString()
		}
		refundTimeStr := ""
		if v.RefundTime != "" {
			refundTimeStr = timeutil.Carbon().Parse(v.RefundTime).ToDateTimeString()
		}
		createdAtStr := ""
		if v.CreatedAt != "" {
			createdAtStr = timeutil.Carbon().Parse(v.CreatedAt).ToDateTimeString()
		}
		updatedAtStr := ""
		if v.UpdatedAt != "" {
			updatedAtStr = timeutil.Carbon().Parse(v.UpdatedAt).ToDateTimeString()
		}

		// 格式化服务状态
		serviceStatusStr := ""
		if v.ServiceStatus != "" {
			serviceStatusStr = constant.ServiceStatusToName[v.ServiceStatus]
		}

		// 格式化商品类型：single -> 单日营，multi -> 多日营
		goodTypeStr := v.GoodType
		switch v.GoodType {
		case "single":
			goodTypeStr = "单日营"
		case "multi":
			goodTypeStr = "多日营"
		}

		record := []string{
			v.OrderNumber,                           // 渠道订单编号
			v.ChannelGoodId,                         // 渠道商品ID
			v.GoodName,                              // 商品名称
			goodTypeStr,                             // 商品类型
			v.ChannelName,                           // 购买渠道
			fmt.Sprintf("¥%.2f", orderPriceYuan),    // 实付金额
			fmt.Sprintf("¥%.2f", receiptAmountYuan), // 实收金额
			fmt.Sprintf("¥%.2f", platformDiscountAmountYuan), // 平台优惠
			fmt.Sprintf("¥%.2f", paymentDiscountAmountYuan),  // 支付优惠
			fmt.Sprintf("¥%.2f", shopDiscountAmountYuan),     // 店铺优惠
			fmt.Sprintf("¥%.2f", actualInsuredYuan),          // 保险费
			fmt.Sprintf("¥%.2f", talentCommissionYuan),       // 达人佣金
			v.TalentUid,                             // 达人UID
			v.TalentName,                            // 达人名称
			fmt.Sprintf("¥%.2f", platformFeeYuan),   // 平台手续费
			v.Phone,                                 // 联系方式
			paymentTimeStr,                          // 支付时间
			settlementTimeStr,                       // 结算时间
			serviceStatusStr,                        // 服务状态
			constant.NewOrderStatusToName[v.Status], // 订单状态
			fmt.Sprintf("¥%.2f", refundAmountYuan),  // 退款金额
			refundTimeStr,                           // 退款时间
			createdAtStr,                            // 创建时间
			updatedAtStr,                            // 更新时间
			v.Id,                                    // 订单编号
			v.GoodId,                                // 商品ID
			v.UpdatedByName,                         // 最后编辑人
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}

	return nil
}

// ExportOrderList 订单-导出订单信息
func (s *ShadowV1OrderUseCase) ExportOrderList(ctx context.Context, req *pb.ExportOrderListReq) (*pb.ExportOrderListReply, error) {
	resp := &pb.ExportOrderListReply{}
	reply, err := s.GetOrderList(ctx, &pb.GetOrderListReq{
		Page:             1,
		PageSize:         10000,
		GoodName:         req.GetGoodName(),
		OrderNumber:      req.GetOrderNumber(),
		Phone:            req.GetPhone(),
		ChannelId:        req.GetChannelId(),
		PaymentTimeStart: req.GetPaymentTimeStart(),
		PaymentTimeEnd:   req.GetPaymentTimeEnd(),
		OrderStatus:      req.GetOrderStatus(),
		ServiceStatus:    req.GetServiceStatus(),
		GoodType:         req.GetGoodType(),
		RefundTimeStart:  req.GetRefundTimeStart(),
		RefundTimeEnd:    req.GetRefundTimeEnd(),
	})
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	if len(reply.List) == 0 {
		return resp, nil
	}

	key := cryptutil.Sha256(req.String())

	// 获取当前工作目录的绝对路径
	currentDir, err := os.Getwd()
	if err != nil {
		s.log.Errorf("获取当前工作目录失败！err: %v", err)
		return resp, err
	}
	dirPath := filepath.Join(currentDir, "yanxue-export", "order")
	// 检查目录是否存在，不存在则创建
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			s.log.Errorf("创建文件夹失败！err: %v", err)
			return resp, err
		}
	}
	path := filepath.Join(dirPath, fmt.Sprintf("%s_%s.csv", timeutil.NowCarbon().ToShortDateTimeString(), key))
	defer func() {
		_ = fileutil.Remove(path)
	}()

	// 生成csv文件
	err = s.ExportContractCsv(ctx, reply, path)
	if err != nil {
		return resp, err
	}

	// 上传到oss
	downloadUrl, err := s.ycOssHttpRpc.UploadOss(ctx, path)
	if err != nil {
		return resp, err
	}

	resp.DownloadUrl = downloadUrl
	return resp, nil
}
