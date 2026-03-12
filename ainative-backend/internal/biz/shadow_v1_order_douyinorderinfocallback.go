package biz

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

type DouYinOrderInfoCallbackTestContent struct {
	Challenge int `json:"challenge"`
}

type DouYinOrderCreateItem struct {
	Action  string `json:"action"`
	MsgTime int    `json:"msg_time"`
	Order   struct {
		AccountId      string `json:"account_id"`
		CreateTime     int64  `json:"create_time"`
		OrderId        string `json:"order_id"`
		OriginalAmount int    `json:"original_amount"`
		PayAmount      int    `json:"pay_amount"`
		PayTime        int64  `json:"pay_time"`
	} `json:"order"`
}

type CreateOrderReq struct {
	OrderId                string
	PayTime                int64
	PayAmount              int
	AccountId              string
	GoodName               string
	GoodId                 string
	GoodNum                int
	AnchorId               string   // 达人ID
	ReceiptAmount          int32    // 实收金额（单位：分）
	DiscountAmount         int32    // 优惠金额（单位：分）
	PlatformDiscountAmount int32    // 平台优惠金额（单位：分）
	PaymentDiscountAmount  int32    // 支付优惠金额（单位：分）
	CertificateIds         []string // 券ID列表（按顺序对应每个子订单）
}

// CreateDouYinOrder 创建单个抖音订单
func (s *ShadowV1OrderUseCase) CreateDouYinOrder(ctx context.Context, req *CreateOrderReq) error {
	var orderDataDBList []*yanxue_model.Order
	// 查询渠道ID
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	douYinChannelId := ""
	for _, channel := range channelList {
		if channel.Name == constant.ChannelTypeDY {
			douYinChannelId = channel.ID
		}
	}
	// 将int64格式的支付时间转换为time.Time类型，精确到秒
	paymentTime := time.Unix(req.PayTime, 0)

	// 如果件数大于1，则需要拆单
	// 计算每个子订单的优惠金额、实收金额、订单价格、平台优惠、支付优惠（平分）
	payAmount := float32(req.PayAmount) / 100 // 抖音返回的单位是分，转换成元
	avgDiscountAmount := req.DiscountAmount / int32(req.GoodNum)
	avgReceiptAmount := req.ReceiptAmount / int32(req.GoodNum)
	avgOrderPrice := payAmount / float32(req.GoodNum)
	avgPlatformDiscountAmount := req.PlatformDiscountAmount / int32(req.GoodNum)
	avgPaymentDiscountAmount := req.PaymentDiscountAmount / int32(req.GoodNum)

	// 用于累计已分配的订单价格，确保最后一个订单补齐差额
	var totalAssignedOrderPrice float32 = 0

	for i := 1; i <= req.GoodNum; i++ {
		// 从第1件商品开始就加后缀：-1, -2, -3...
		orderNumber := fmt.Sprintf("%s-%d", req.OrderId, i)

		// 计算当前子订单的优惠金额（单位：分）
		subOrderDiscountAmount := avgDiscountAmount
		// 计算当前子订单的实收金额（单位：分）
		subOrderReceiptAmount := avgReceiptAmount
		// 计算当前子订单的订单价格（单位：元）
		subOrderPrice := avgOrderPrice
		// 计算当前子订单的平台优惠金额（单位：分）
		subOrderPlatformDiscountAmount := avgPlatformDiscountAmount
		// 计算当前子订单的支付优惠金额（单位：分）
		subOrderPaymentDiscountAmount := avgPaymentDiscountAmount

		// 最后一个子订单补齐差额
		if i == req.GoodNum {
			subOrderDiscountAmount = req.DiscountAmount - (avgDiscountAmount * int32(req.GoodNum-1))
			subOrderReceiptAmount = req.ReceiptAmount - (avgReceiptAmount * int32(req.GoodNum-1))
			subOrderPrice = payAmount - totalAssignedOrderPrice
			subOrderPlatformDiscountAmount = req.PlatformDiscountAmount - (avgPlatformDiscountAmount * int32(req.GoodNum-1))
			subOrderPaymentDiscountAmount = req.PaymentDiscountAmount - (avgPaymentDiscountAmount * int32(req.GoodNum-1))
		} else {
			totalAssignedOrderPrice += subOrderPrice
		}

		// 获取对应的 certificateId（如果存在）
		// 券ID列表的索引从0开始，订单索引从1开始，所以需要 i-1
		var certificateId string
		if len(req.CertificateIds) > 0 && i-1 < len(req.CertificateIds) {
			certificateId = req.CertificateIds[i-1]
		}

		orderDataDBList = append(orderDataDBList, &yanxue_model.Order{
			GoodID:                 "",
			ChannelGoodID:          req.GoodId,
			ChannelID:              douYinChannelId,
			OrderPrice:             subOrderPrice,
			Status:                 string(constant.OrderStatusPending),
			OrderNumber:            orderNumber,
			OriginOrderNumber:      req.OrderId,
			PaymentTime:            paymentTime,
			TalentUID:              req.AnchorId,                   // 达人ID
			ReceiptAmount:          subOrderReceiptAmount,          // 实收金额（单位：分）
			DiscountAmount:         subOrderDiscountAmount,         // 优惠金额（单位：分）
			PlatformDiscountAmount: subOrderPlatformDiscountAmount, // 平台优惠金额（单位：分）
			PaymentDiscountAmount:  subOrderPaymentDiscountAmount,  // 支付优惠金额（单位：分）
			CertificateID:          certificateId,                  // 券ID
			ServiceStatus:          string(constant.OrderStatusPending),
		})
	}

	var orderNumberList []string
	channelGoodIds := make([]string, 0)
	for _, order := range orderDataDBList {
		orderNumberList = append(orderNumberList, order.OrderNumber)
		channelGoodIds = append(channelGoodIds, order.ChannelGoodID)
	}
	goodList, err := s.goodRepo.FindMultiByChannelGoodIDS(ctx, channelGoodIds)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	channelGoodIdToGoodIdMap := make(map[string]string)
	platformGoodIds := make([]string, 0)
	for _, good := range goodList {
		channelGoodIdToGoodIdMap[good.ChannelGoodID] = good.ID
		platformGoodIds = append(platformGoodIds, good.PlatformGoodID)
	}

	// 查询商品类型
	platformGoodIdToGoodTypeMap, err := s.platformGoodRepo.PlatformGoodIdToGoodType(ctx, platformGoodIds)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}

	orderNumberToItemMap := make(map[string]*yanxue_model.Order)
	// 查询数据是否已存在
	orderDBList, err := s.orderRepo.FindMultiByOrderNumbers(ctx, orderNumberList)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	for _, order := range orderDBList {
		orderNumberToItemMap[order.OrderNumber] = order
	}

	var needCreateOrderList []*yanxue_model.Order
	for _, order := range orderDataDBList {
		order.GoodID = channelGoodIdToGoodIdMap[order.ChannelGoodID]
		if order.GoodID == "" {
			return errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("商品渠道ID:%s 对应商品不存在！", order.ChannelGoodID))
		}

		// 根据goodID找到对应的platformGoodID，再获取商品类型
		for _, good := range goodList {
			if good.ID == order.GoodID {
				order.GoodType = platformGoodIdToGoodTypeMap[good.PlatformGoodID]
				break
			}
		}

		if _, ok := orderNumberToItemMap[order.OrderNumber]; !ok {
			// 不存在则新增
			needCreateOrderList = append(needCreateOrderList, order)
		}
	}
	// 如果没有需要新增的，则直接返回
	if len(needCreateOrderList) == 0 {
		return nil
	}
	err = s.orderRepo.CreateBatchCache(ctx, needCreateOrderList, 200)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}

	// 为每个新创建的订单拆分子订单
	for _, order := range needCreateOrderList {
		err = s.SplitOrderToSubOrders(ctx, order.ID)
		if err != nil {
			s.log.Errorf("抖音订单拆单失败，orderId=%s, err=%v", order.ID, err)
			// 拆单失败不影响主流程
		}
	}

	return nil
}

// DouYinOrderInfoCallback 抖音订单消息回传
func (s *ShadowV1OrderUseCase) DouYinOrderInfoCallback(ctx context.Context, req *pb.DouYinOrderInfoCallbackReq) (*pb.DouYinOrderInfoCallbackReply, error) {
	resp := &pb.DouYinOrderInfoCallbackReply{}

	// 检查是否是重试任务
	isRetry := false
	if ctx.Value("isRetryTask") != nil {
		isRetry = ctx.Value("isRetryTask").(bool)
	}

	content := &DouYinOrderInfoCallbackTestContent{}
	contentStr := strings.ReplaceAll(req.Content, `\"`, `"`)
	err := jsonutil.Unmarshal([]byte(contentStr), content)
	if err == nil && content.Challenge != 0 { // 测试消息
		s.log.Infof("抖音订单回传测试消息！challenge:%d", content.Challenge)
		resp.Challenge = int32(content.Challenge)
		return resp, nil
	} else { // 正式消息
		// 订单新增
		douYinOrderCreateItem := &DouYinOrderCreateItem{}
		err = jsonutil.Unmarshal([]byte(contentStr), douYinOrderCreateItem)
		if err != nil {
			s.log.Errorf("新增抖音订单失败！序列化失败！失败原因：%s", err.Error())
			// 只有非重试任务才记录失败任务
			if !isRetry {
				s.recordFailedTask(ctx, req, fmt.Sprintf("序列化失败: %v", err))
			}
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		if douYinOrderCreateItem.Action == "pay_success" {
			orderId := douYinOrderCreateItem.Order.OrderId
			payTime := douYinOrderCreateItem.Order.PayTime
			accountId := douYinOrderCreateItem.Order.AccountId
			payAmount := douYinOrderCreateItem.Order.PayAmount
			s.log.Infof("抖音订单新增 orderId:%s,payTime:%d", orderId, payTime)
			douYinOrderInfo, err := s.httpRpc.QueryDouYinOrderInfo(ctx, &rpc.QueryDouYinOrderInfoReqParams{
				AccountId: accountId,
				OrderId:   orderId,
				PageNum:   1,
				PageSize:  100,
			})
			if err != nil {
				s.log.Errorf("查询抖音订单信息失败！失败原因：%s", err.Error())
				// 只有非重试任务才记录失败任务
				if !isRetry {
					s.recordFailedTask(ctx, req, fmt.Sprintf("查询抖音订单信息失败: %v", err))
				}
				return resp, err
			}
			s.log.Info("抖音订单信息", douYinOrderInfo)
			if len(douYinOrderInfo.Data.Orders) == 0 {
				s.log.Errorf("抖音新增订单失败，回查订单没有查到！订单ID:%s", orderId)
				// 只有非重试任务才记录失败任务
				if !isRetry {
					s.recordFailedTask(ctx, req, fmt.Sprintf("回查订单没有查到, orderId: %s", orderId))
				}
				return resp, errorx.APIThirdErr.Err()
			} else {
				orderInfo := douYinOrderInfo.Data.Orders[0]
				if orderInfo.OrderStatus != constant.OrderStatusPaySuccess &&
					orderInfo.OrderStatus != constant.OrderStatusAvailable &&
					orderInfo.OrderStatus != constant.OrderStatusPartPay {
					s.log.Warnf("抖音新增订单失败，回查订单状态不是支付成功/待使用/部分支付！订单ID:%s,订单状态:%s", orderId, orderInfo.OrderStatus)
					// 只有非重试任务才记录失败任务
					if !isRetry {
						s.recordFailedTask(ctx, req, fmt.Sprintf("回查订单状态不是支付成功/待使用/部分支付, orderId: %s", orderId))
					}
					return resp, errorx.ParamErr.Err()
				}
				goodName := orderInfo.SkuName
				goodId := orderInfo.SkuId
				goodNum := orderInfo.Count

				// 从 QueryDouYinOrderInfo 的返回结果中提取券ID列表
				var certificateIds []string
				for _, cert := range orderInfo.Certificate {
					certificateIds = append(certificateIds, cert.CertificateId)
				}
				s.log.Infof("从订单信息中提取券ID列表，orderId=%s, 券数量=%d, 券ID列表=%v",
					orderId, len(certificateIds), certificateIds)

				// 调用 QueryDouYinCertificate 查询券状态，计算实收金额和优惠金额
				var receiptAmount int32 = 0
				var discountAmount int32 = 0
				var platformDiscountAmount int32 = 0
				var paymentDiscountAmount int32 = 0
				certificateReply, err := s.httpRpc.QueryDouYinCertificate(ctx, &rpc.QueryDouYinCertificateReqParams{
					OrderId:   orderId,
					AccountId: accountId,
				})
				if err != nil {
					s.log.Errorf("查询抖音券状态失败，使用订单信息中的实收金额作为兜底，orderId=%s, err=%v", orderId, err)
					receiptAmount = 0
					discountAmount = 0
					platformDiscountAmount = 0
					paymentDiscountAmount = 0
				} else {
					// 检查是否查询到券信息
					if len(certificateReply.Data.Certificates) == 0 {
						s.log.Warnf("查询抖音券状态返回空数组，使用订单信息中的实收金额作为兜底，orderId=%s", orderId)
						receiptAmount = 0
						discountAmount = 0
						platformDiscountAmount = 0
						paymentDiscountAmount = 0
					} else {
						// 计算实收金额和优惠金额
						for _, cert := range certificateReply.Data.Certificates {
							certPayAmount := cert.Amount.PayAmount
							certPlatformDiscountAmount := cert.Amount.PlatformDiscountAmount
							certPaymentDiscountAmount := cert.Amount.PaymentDiscountAmount
							certReceiptAmount := certPayAmount + certPlatformDiscountAmount + certPaymentDiscountAmount
							receiptAmount += int32(certReceiptAmount)
							// 优惠金额 = platformDiscountAmount + paymentDiscountAmount
							certDiscountAmount := certPlatformDiscountAmount + certPaymentDiscountAmount
							discountAmount += int32(certDiscountAmount)
							// 累加平台优惠和支付优惠
							platformDiscountAmount += int32(certPlatformDiscountAmount)
							paymentDiscountAmount += int32(certPaymentDiscountAmount)
							s.log.Infof("抖音券实收金额计算，orderId=%s, code=%s, payAmount=%d, platformDiscountAmount=%d, paymentDiscountAmount=%d, certReceiptAmount=%d, certDiscountAmount=%d",
								orderId, cert.Code, certPayAmount, certPlatformDiscountAmount, certPaymentDiscountAmount, certReceiptAmount, certDiscountAmount)
						}
					}
				}

				s.log.Infof("抖音订单实收金额和优惠金额，orderId=%s, receiptAmount=%d分, discountAmount=%d分, platformDiscountAmount=%d分, paymentDiscountAmount=%d分",
					orderId, receiptAmount, discountAmount, platformDiscountAmount, paymentDiscountAmount)

				err = s.CreateDouYinOrder(ctx, &CreateOrderReq{
					OrderId:                orderId,
					PayTime:                payTime,
					PayAmount:              payAmount,
					AccountId:              accountId,
					GoodName:               goodName,
					GoodId:                 goodId,
					GoodNum:                int(goodNum),
					ReceiptAmount:          receiptAmount,
					DiscountAmount:         discountAmount,         // 优惠金额（单位：分）
					PlatformDiscountAmount: platformDiscountAmount, // 平台优惠金额（单位：分）
					PaymentDiscountAmount:  paymentDiscountAmount,  // 支付优惠金额（单位：分）
					CertificateIds:         certificateIds,         // 券ID列表
				})
				if err != nil {
					s.log.Errorf("创建抖音订单失败！订单ID:%s,错误:%s", orderId, err.Error())
					// 只有非重试任务才记录失败任务
					if !isRetry {
						s.recordFailedTask(ctx, req, fmt.Sprintf("创建订单失败, orderId: %s, error: %v", orderId, err))
					}
					return resp, errorx.DataSQLErr.WithError(err).Err()
				}
			}
		}
	}
	return resp, nil
}

// recordFailedTask 记录失败的任务到 async_task 表
// 保存完整的 req 参数，包括 content, msgSignature, timestamp, nonce
func (s *ShadowV1OrderUseCase) recordFailedTask(ctx context.Context, req *pb.DouYinOrderInfoCallbackReq, errorInfo string) {
	// 将完整的 req 序列化为 JSON
	reqJSON, err := jsonutil.Marshal(req)
	if err != nil {
		s.log.Errorf("序列化 req 失败: %v", err)
		reqJSON = []byte(req.Content) // 降级为只保存 content
	}

	task := &yanxue_model.AsyncTask{
		TaskType:    constant.DouYinOrderCallbackTaskType,
		Status:      constant.AsyncTaskStatusPending,
		ErrorInfo:   errorInfo,
		TaskContent: string(reqJSON), // 保存完整的 req JSON
		RetryTimes:  0,
	}

	err = s.asyncTaskRepo.CreateOneCache(ctx, task)
	if err != nil {
		s.log.Errorf("记录失败任务到async_task表失败: %v, req: %s", err, string(reqJSON))
	} else {
		s.log.Infof("成功记录失败任务到async_task表, taskId: %s, errorInfo: %s", task.ID, errorInfo)
	}
}

type WeiDianOrderGoodInfo struct {
	PayAmount  string
	GoodName   string
	GoodId     string
	GoodNum    string
	Phone      string
	LastIncome string
}

type CreateWeiDianOrderReq struct {
	OrderId                  string
	PayTime                  string
	WeiDianOrderGoodInfoList []*WeiDianOrderGoodInfo
}

// CreateWeiDianOrder 创建单个微店订单
func (s *ShadowV1OrderUseCase) CreateWeiDianOrder(ctx context.Context, req *CreateWeiDianOrderReq) error {
	var orderDataDBList []*yanxue_model.Order
	// 查询渠道ID
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	weiDianChannelId := ""
	for _, channel := range channelList {
		if channel.Name == constant.ChannelTypeWD {
			weiDianChannelId = channel.ID
		}
	}
	// 将int64格式的支付时间转换为time.Time类型，精确到秒
	paymentTime := timeutil.Carbon().Parse(req.PayTime).ToStdTime()
	// 如果件数大于1，则需要拆单
	weiDianOrderGoodInfoList := req.WeiDianOrderGoodInfoList
	if weiDianOrderGoodInfoList == nil || len(weiDianOrderGoodInfoList) == 0 {
		return errors.New(http.StatusBadRequest, "-1", "商品信息列表为空")
	}
	// 订单编号计数器，从1开始
	orderIndex := 1
	// 遍历每个商品信息
	for _, goodInfo := range weiDianOrderGoodInfoList {
		if goodInfo == nil {
			s.log.Warnf("CreateWeiDianOrder: 商品信息为空，跳过")
			continue
		}
		payAmount, err := strconv.ParseFloat(goodInfo.PayAmount, 32)
		if err != nil {
			return errorx.DataFormattingError.WithError(err).Err()
		}
		goodNum, err := strconv.Atoi(goodInfo.GoodNum)
		if err != nil {
			return errorx.DataFormattingError.WithError(err).Err()
		}
		if goodNum <= 0 {
			s.log.Warnf("CreateWeiDianOrder: 商品数量为0或负数，跳过，GoodId=%s", goodInfo.GoodId)
			continue
		}
		lastIncomeTotal, err := strconv.ParseFloat(goodInfo.LastIncome, 32)
		if err != nil {
			return errorx.DataFormattingError.WithError(err).Err()
		}
		goodId := goodInfo.GoodId
		orderPrice := payAmount / float64(goodNum)
		lastIncome := lastIncomeTotal * 100 / float64(goodNum) // 单位分
		receiptAmount := int32(lastIncome + 0.5)
		// 计算手续费：手续费 = 实收金额 * 0.6%，四舍五入到整数
		platformFee := int32(math.Round(float64(receiptAmount) * 0.006))
		// 对每个商品，根据数量拆分成多个订单
		for j := 1; j <= goodNum; j++ {
			// 从第1件商品开始就加后缀：-1, -2, -3...
			orderNumber := fmt.Sprintf("%s-%d", req.OrderId, orderIndex)
			ph, err := cryptutil.YcPhoneEncrypt(goodInfo.Phone)
			if err != nil {
				s.log.Errorf("加密手机号:%s失败！失败原因：%s", goodInfo.Phone, err.Error())
			}
			orderDataDBList = append(orderDataDBList, &yanxue_model.Order{
				GoodID:            "",
				ChannelGoodID:     goodId,
				ChannelID:         weiDianChannelId,
				OrderPrice:        float32(orderPrice),
				Status:            string(constant.OrderStatusPending),
				OrderNumber:       orderNumber,
				OriginOrderNumber: req.OrderId,
				PaymentTime:       paymentTime,
				Ph:                ph,
				ReceiptAmount:     receiptAmount,
				PlatformFee:       platformFee, // 平台手续费：单位分
				ServiceStatus:     string(constant.OrderStatusPending),
			})
			orderIndex++
		}
	}

	var orderNumberList []string
	channelGoodIds := make([]string, 0)
	for _, order := range orderDataDBList {
		orderNumberList = append(orderNumberList, order.OrderNumber)
		channelGoodIds = append(channelGoodIds, order.ChannelGoodID)
	}
	goodList, err := s.goodRepo.FindMultiByChannelGoodIDS(ctx, channelGoodIds)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	channelGoodIdToGoodIdMap := make(map[string]string)
	goodIdToPlatformGoodIdMap := make(map[string]string)
	platformGoodIdSet := make(map[string]bool)
	for _, good := range goodList {
		channelGoodIdToGoodIdMap[good.ChannelGoodID] = good.ID
		if good.PlatformGoodID != "" {
			goodIdToPlatformGoodIdMap[good.ID] = good.PlatformGoodID
			platformGoodIdSet[good.PlatformGoodID] = true
		}
	}

	// 查询平台商品信息，获取商品类型
	var platformGoodIds []string
	for platformGoodId := range platformGoodIdSet {
		platformGoodIds = append(platformGoodIds, platformGoodId)
	}

	var goodIdToTypeMap map[string]string
	if len(platformGoodIds) > 0 {
		platformGoods, err := s.platformGoodRepo.FindMultiCacheByIDS(ctx, platformGoodIds)
		if err != nil {
			s.log.Errorf("CreateWeiDianOrder: 查询平台商品失败, err=%v", err)
			// 不影响订单创建流程，继续执行
		} else {
			// 构建 platformGoodId -> goodType 映射
			platformGoodIdToTypeMap := make(map[string]string)
			for _, platformGood := range platformGoods {
				if platformGood.GoodType != "" {
					platformGoodIdToTypeMap[platformGood.ID] = platformGood.GoodType
				}
			}

			// 构建 goodId -> goodType 映射
			goodIdToTypeMap = make(map[string]string)
			for goodId, platformGoodId := range goodIdToPlatformGoodIdMap {
				if goodType, exists := platformGoodIdToTypeMap[platformGoodId]; exists {
					goodIdToTypeMap[goodId] = goodType
				}
			}

			s.log.Infof("CreateWeiDianOrder: 成功获取 %d 个商品的类型信息", len(goodIdToTypeMap))
		}
	}

	orderNumberToItemMap := make(map[string]*yanxue_model.Order)
	// 查询数据是否已存在
	orderDBList, err := s.orderRepo.FindMultiByOrderNumbers(ctx, orderNumberList)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	for _, order := range orderDBList {
		orderNumberToItemMap[order.OrderNumber] = order
	}

	var needCreateOrderList []*yanxue_model.Order
	for _, order := range orderDataDBList {
		order.GoodID = channelGoodIdToGoodIdMap[order.ChannelGoodID]
		if order.GoodID == "" {
			return errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("商品渠道ID:%s 对应商品不存在！", order.ChannelGoodID))
		}

		// 赋值商品类型
		if goodIdToTypeMap != nil {
			if goodType, exists := goodIdToTypeMap[order.GoodID]; exists && goodType != "" {
				order.GoodType = goodType
				s.log.Infof("CreateWeiDianOrder: 订单 %s 赋值商品类型为 %s", order.OrderNumber, goodType)
			} else {
				s.log.Warnf("CreateWeiDianOrder: 订单 %s 未找到商品类型, goodId=%s", order.OrderNumber, order.GoodID)
			}
		}

		if _, ok := orderNumberToItemMap[order.OrderNumber]; !ok {
			// 不存在则新增
			needCreateOrderList = append(needCreateOrderList, order)
		}
	}
	// 如果没有需要新增的，则直接返回
	if len(needCreateOrderList) == 0 {
		return nil
	}
	err = s.orderRepo.CreateBatchCache(ctx, needCreateOrderList, 200)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}

	// 为每个新创建的订单拆分子订单
	for _, order := range needCreateOrderList {
		err = s.SplitOrderToSubOrders(ctx, order.ID)
		if err != nil {
			s.log.Errorf("微店订单拆单失败，orderId=%s, err=%v", order.ID, err)
			// 拆单失败不影响主流程
		}
	}

	return nil
}
