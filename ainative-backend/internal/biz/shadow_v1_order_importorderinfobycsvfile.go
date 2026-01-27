package biz

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/fileutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// isScientificNotation 用于判断字符串是否为科学计数法表示（如 1.23e+10、-4.5E-3 等）
// 只返回 true 当且仅当字符串严格为科学计数法格式
func isScientificNotation(s string) bool {
	// 去除前后空白
	s = strings.TrimSpace(s)
	// 科学计数法的正则：必须包含e或E，前后为数字（可带小数点），e后为整数（可带正负号）
	pattern := `^[+-]?(\d+(\.\d+)?|\.\d+)[eE][+-]?\d+$`
	re := regexp.MustCompile(pattern)
	return re.MatchString(s)
}

// TrimWhitespace 去除字符串前后的空白字符（包括空格、制表符、换行符等）以及开头的UTF-8 BOM
func TrimWhitespace(s string) string {
	// 先去除开头的UTF-8 BOM（'\uFEFF'）
	s = strings.TrimPrefix(s, "\uFEFF")
	// 去除字符串前后的空白字符
	return strings.TrimSpace(s)
}

func (s *ShadowV1OrderUseCase) GetDynamicFieldMapping(ctx context.Context, req *pb.GetDynamicFieldMappingListReq) (map[string]string, map[string]string, error) {
	fieldMapping := make(map[string]string)
	enumMapping := make(map[string]string)
	// 查询字段和枚举映射信息
	dynamicFieldMappingList, _, err := s.dynamicFieldMappingRepo.QueryDynamicFieldMappingList(ctx, req)
	if err != nil {
		return fieldMapping, enumMapping, err
	}
	dynamicFieldMappingPbList := &pb.GetDynamicFieldMappingListReply{}
	for _, item := range dynamicFieldMappingList {
		mappingInfo, err := s.dynamicFieldMappingRepo.DTOShadowDynamicFieldMapping(item)
		if err != nil {
			return fieldMapping, enumMapping, err
		}
		dynamicFieldMappingPbList.List = append(dynamicFieldMappingPbList.List, mappingInfo)
	}
	for _, item := range dynamicFieldMappingPbList.List {
		if item.MappingType == constant.MappingTypeField {
			for _, mappingData := range item.Data {
				fieldMapping[mappingData.SysDynamicFieldName] = mappingData.CsvDynamicFieldName
			}
		} else if item.MappingType == constant.MappingTypeEnum {
			for _, mappingData := range item.Data {
				enumMapping[mappingData.CsvDynamicFieldName] = mappingData.SysDynamicFieldName
			}
		}
	}
	return fieldMapping, enumMapping, nil
}

// ImportOrderInfoByCsvFile 订单-导入订单信息
func (s *ShadowV1OrderUseCase) ImportOrderInfoByCsvFile(ctx context.Context, req *pb.ImportOrderInfoByCsvFileReq) (*pb.ImportOrderInfoByCsvFileReply, error) {
	reply := &pb.ImportOrderInfoByCsvFileReply{}
	// 操作人
	adminId := meta.GetAdminID(ctx)
	// 检查文件格式是否为CSV
	fileUrl := req.GetFileUrl()
	if !strings.HasSuffix(strings.ToLower(fileUrl), ".csv") {
		return reply, errors.New(http.StatusBadRequest, "-1", "只支持CSV格式文件！")
	}

	// 读取文件内容
	fileBytes, err := fileutil.ReadFileByURLToByte(fileUrl)
	if err != nil {
		return reply, errors.New(http.StatusInternalServerError, "-1", "文件读取失败！请稍后重试！")
	}

	// 检测文件编码，如果是GBK/GB2312则转换为UTF-8
	csvContent := fileBytes
	// 检测文件编码并处理
	if utf8.Valid(fileBytes) {
		// 文件已经是UTF-8编码，无需转换
		csvContent = fileBytes
	} else {
		// 尝试将GBK/GB2312编码转换为UTF-8
		reader := transform.NewReader(bytes.NewReader(fileBytes), simplifiedchinese.GBK.NewDecoder())
		var err error
		csvContent, err = io.ReadAll(reader)
		if err != nil {
			return reply, errors.New(http.StatusInternalServerError, "-1", "文件编码转换失败！")
		}
	}

	// 按行分割内容
	csvSlice := strings.Split(string(csvContent), "\n")
	if len(csvSlice) <= 1 {
		return reply, errors.New(http.StatusBadRequest, "-1", "文件不能为空！")
	}

	// 解析CSV文件标题行
	titleStr := csvSlice[0]
	csvReader := csv.NewReader(strings.NewReader(titleStr))
	csvReader.Comma = ','
	titleSlice, err := csvReader.Read()
	if err != nil {
		return reply, errors.New(http.StatusBadRequest, "-1", "标题解析失败！")
	}

	var fieldNameList []string
	for _, item := range titleSlice {
		fieldNameList = append(fieldNameList, strings.TrimSpace(item))
	}

	// 处理数据行
	var orderDataList []map[string]interface{}
	for i := 1; i < len(csvSlice); i++ {
		if csvSlice[i] == "" {
			continue
		}
		//if strings.Contains(csvSlice[i], "\n") || strings.Contains(csvSlice[i], "\r") || strings.Contains(csvSlice[i], "\r\n") {
		//	return reply, errors.New(http.StatusBadRequest, "-1", "文件中不能包含换行符！")
		//}

		dataStr := csvSlice[i]
		csvSliceReader := csv.NewReader(strings.NewReader(dataStr))
		csvSliceReader.Comma = ','
		dataSlice, err := csvSliceReader.Read()
		if err != nil {
			return reply, errors.New(http.StatusBadRequest, "-1", "数据解析失败！")
		}
		if len(dataSlice) != len(titleSlice) {
			return reply, errors.New(http.StatusBadRequest, "-1", "数据列数与标题列数不一致，请检查数据是否包含额外的换行符！")
		}

		// 构建每行数据的字段映射
		orderData := make(map[string]interface{})
		for j := 0; j < len(dataSlice); j++ {
			value := TrimWhitespace(dataSlice[j])
			if value == "" {
				continue
			}
			// 校验是否包含科学计数法
			if isScientificNotation(value) {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s字段不能包含科学计数法！", fieldNameList[j]))
			}
			orderData[TrimWhitespace(fieldNameList[j])] = value
		}
		if len(orderData) > 0 {
			orderDataList = append(orderDataList, orderData)
		}
	}

	// 查询渠道信息
	channelList, _, err := s.channelRepo.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return reply, errorx.DataSQLErr.WithError(err).Err()
	}
	channelMap := make(map[string]string)
	for _, channel := range channelList {
		channelMap[channel.ID] = channel.Name
	}

	//小程序订单不允许导入
	if channelMap[req.ChannelId] == constant.ChannelTypeXCX {
		return reply, errors.New(http.StatusBadRequest, "-1", "小程序订单不允许导入！")
	}

	// 支持的渠道：抖音、微店、视频号小店等
	// 视频号小店渠道支持导入，使用通用导入逻辑
	channelName := channelMap[req.ChannelId]
	s.log.Infof("ImportOrderInfoByCsvFile: 开始导入订单，渠道类型：%s", channelName)

	// 查询字段和枚举映射信息
	fieldMapping, enumMapping, err := s.GetDynamicFieldMapping(ctx, &pb.GetDynamicFieldMappingListReq{
		Page:     1,
		PageSize: 100,
		Channel:  channelMap[req.ChannelId],
	})
	if err != nil {
		return reply, err
	}

	var orderDataDBList []*yanxue_model.Order
	// 渠道商品Id
	channelGoodIdFieldName := fieldMapping["渠道商品Id"]
	if channelGoodIdFieldName == "" {
		return reply, errors.New(http.StatusBadRequest, "-1", "请检查是否配置了渠道商品Id映射！")
	}
	// 订单金额
	orderPriceFieldName := fieldMapping["订单金额"]
	if orderPriceFieldName == "" {
		return reply, errors.New(http.StatusBadRequest, "-1", "请检查是否配置了订单金额映射！")
	}
	// 联系电话
	phoneFieldName := fieldMapping["联系方式"]
	if phoneFieldName == "" {
		return reply, errors.New(http.StatusBadRequest, "-1", "请检查是否配置了联系方式映射！")
	}
	// 订单状态
	orderStatusFieldName := fieldMapping["订单状态"]
	if orderStatusFieldName == "" {
		return reply, errors.New(http.StatusBadRequest, "-1", "请检查是否配置了订单状态映射！")
	}
	// 订单编号
	orderNumberFieldName := fieldMapping["订单编号"]
	if orderNumberFieldName == "" {
		return reply, errors.New(http.StatusBadRequest, "-1", "请检查是否配置了订单编号映射！")
	}
	// 支付时间
	payTimeFieldName := fieldMapping["支付时间"]
	if payTimeFieldName == "" {
		return reply, errors.New(http.StatusBadRequest, "-1", "请检查是否配置了支付时间映射！")
	}
	// 商品件数
	goodNumFieldName := fieldMapping["商品件数"]
	if goodNumFieldName == "" {
		return reply, errors.New(http.StatusBadRequest, "-1", "请检查是否配置了商品件数映射！")
	}
	// 渠道商品名称
	channelGoodName := fieldMapping["商品名称"]
	if channelGoodName == "" {
		return reply, errors.New(http.StatusBadRequest, "-1", "请检查是否配置了商品名称映射！")
	}

	// 以下字段为可选字段，允许为空
	receiptAmountFieldName := fieldMapping["卖家实收金额"]  // 可选
	discountAmountFieldName := fieldMapping["优惠金额"]   // 可选
	platformFeeFieldName := fieldMapping["平台手续费"]     // 可选
	refundTimeFieldName := fieldMapping["退款时间"]       // 可选
	refundAmountFieldName := fieldMapping["退款金额"]     // 可选
	talentNameFieldName := fieldMapping["达人名称"]       // 可选
	talentUIDFieldName := fieldMapping["达人uid"]       // 可选
	talentCommissionFieldName := fieldMapping["达人佣金"] // 可选

	// 需要先校验商品ID是否存在
	var channelGoodIdList []string
	var orderNumberStrList []string
	channelGoodIdToNameMap := make(map[string]string)
	for _, item := range orderDataList {
		// 校验商品ID
		if _, ok := item[channelGoodIdFieldName]; !ok {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", channelGoodIdFieldName))
		}
		channelGoodIdStr, ok := item[channelGoodIdFieldName].(string)
		if !ok || channelGoodIdStr == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", channelGoodIdFieldName))
		}
		// 校验商品ID必须为纯数字字符串
		for _, c := range channelGoodIdStr {
			if c < '0' || c > '9' {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s:%s 不是纯数字字符串！", channelGoodIdFieldName, channelGoodIdStr))
			}
		}
		// 赋值渠道商品Id到商品名称的映射
		channelGoodIdToNameMap[channelGoodIdStr] = item[channelGoodName].(string)
		channelGoodIdList = append(channelGoodIdList, channelGoodIdStr)
		// 订单编号
		if _, ok := item[orderNumberFieldName]; !ok {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", orderNumberFieldName))
		}
		orderNumberStr, ok := item[orderNumberFieldName].(string)
		if !ok || orderNumberStr == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", orderNumberFieldName))
		}
		orderNumberStrList = append(orderNumberStrList, orderNumberStr)
	}

	channelGoodList, err := s.goodRepo.FindMultiByChannelGoodIDS(ctx, channelGoodIdList)
	if err != nil {
		return reply, errors.New(http.StatusInternalServerError, "-1", "查询商品信息失败！")
	}
	channelGoodIdExistMap := make(map[string]bool)
	for _, good := range channelGoodList {
		channelGoodIdExistMap[good.ChannelGoodID] = true
	}
	notExistGoodIdMap := make(map[string]bool)
	for _, channelGoodId := range channelGoodIdList {
		if !channelGoodIdExistMap[channelGoodId] {
			notExistGoodIdMap[channelGoodId] = true
		}
	}

	skipImportOrderNums := int32(0)
	for _, item := range orderDataList {
		// 商品Id
		channelGoodIdStr, ok := item[channelGoodIdFieldName].(string)
		// 如果渠道商品ID不存在，则跳过
		if !channelGoodIdExistMap[channelGoodIdStr] {
			skipImportOrderNums++
			continue
		}
		// 渠道Id
		channelId := req.GetChannelId()
		// 订单金额
		if orderPrice, ok := item[orderPriceFieldName]; !ok || orderPrice == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", orderPriceFieldName))
		}
		orderPriceStr, _ := item[orderPriceFieldName].(string)
		// 去除千分位逗号
		orderPriceStr = strings.ReplaceAll(orderPriceStr, ",", "")
		orderPriceFloat, err := strconv.ParseFloat(orderPriceStr, 64)
		if err != nil {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s格式错误，无法转换为数字！", orderPriceFieldName))
		}
		// 电话
		phoneStr := ""
		if _, ok := item[phoneFieldName]; ok {
			phoneStr = item[phoneFieldName].(string)
		}
		ph := ""
		if phoneStr != "" {
			ph, err = cryptutil.YcPhoneEncrypt(phoneStr)
			if err != nil {
				return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请检查%s:%s是否有效！", phoneFieldName, phoneStr))
			}
		}
		// 订单状态
		if orderStatus, ok := item[orderStatusFieldName]; !ok || orderStatus == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", orderStatusFieldName))
		}
		orderStatusStr := item[orderStatusFieldName].(string)
		status := enumMapping[orderStatusStr]
		if status == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("请检查%s是否已配置了状态映射关系！", status))
		}
		// 订单编号
		if _, ok := item[orderNumberFieldName]; !ok {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", orderNumberFieldName))
		}
		orderNumberStr, ok := item[orderNumberFieldName].(string)
		if !ok || orderNumberStr == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", orderNumberFieldName))
		}
		// 支付时间
		if paymentTime, ok := item[payTimeFieldName]; !ok || paymentTime == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", payTimeFieldName))
		}
		paymentTimeStr := formatDateStandardString(item[payTimeFieldName].(string))
		paymentTime := timeutil.Carbon().Parse(paymentTimeStr).ToStdTime()
		// 商品件数
		if _, ok := item[goodNumFieldName]; !ok {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能为空！", goodNumFieldName))
		}
		goodNumStr, ok := item[goodNumFieldName].(string)
		goodNumInt, err := strconv.Atoi(goodNumStr)
		if err != nil {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s格式错误，无法转换为数字！", goodNumFieldName))
		}
		if !ok || goodNumInt <= 0 {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("%s不能小于等于0！", goodNumFieldName))
		}

		// 解析可选字段
		// 卖家实收金额（可选，单位：元，需转换为分）
		var receiptAmount int32
		if receiptAmountFieldName != "" {
			if receiptAmountValue, ok := item[receiptAmountFieldName]; ok && receiptAmountValue != "" {
				receiptAmountStr := strings.ReplaceAll(receiptAmountValue.(string), ",", "")
				if receiptAmountFloat, err := strconv.ParseFloat(receiptAmountStr, 64); err == nil {
					receiptAmount = int32(receiptAmountFloat*100 + 0.5) // 元转分，四舍五入
				}
			}
		}

		// 优惠金额（可选，单位：元，需转换为分）
		var discountAmount int32
		if discountAmountFieldName != "" {
			if discountAmountValue, ok := item[discountAmountFieldName]; ok && discountAmountValue != "" {
				discountAmountStr := strings.ReplaceAll(discountAmountValue.(string), ",", "")
				if discountAmountFloat, err := strconv.ParseFloat(discountAmountStr, 64); err == nil {
					discountAmount = int32(discountAmountFloat*100 + 0.5) // 元转分，四舍五入
				}
			}
		}

		// 平台手续费（可选，单位：元，需转换为分）
		var platformFee int32
		if platformFeeFieldName != "" {
			if platformFeeValue, ok := item[platformFeeFieldName]; ok && platformFeeValue != "" {
				platformFeeStr := strings.ReplaceAll(platformFeeValue.(string), ",", "")
				if platformFeeFloat, err := strconv.ParseFloat(platformFeeStr, 64); err == nil {
					platformFee = int32(platformFeeFloat*100 + 0.5) // 元转分，四舍五入
				}
			}
		}

		// 退款时间（可选）
		var refundTime time.Time
		if refundTimeFieldName != "" {
			if refundTimeValue, ok := item[refundTimeFieldName]; ok && refundTimeValue != "" {
				refundTimeStr := formatDateStandardString(refundTimeValue.(string))
				refundTime = timeutil.Carbon().Parse(refundTimeStr).ToStdTime()
			}
		}

		// 退款金额（可选，单位：元，需转换为分）
		var refundAmount int32
		if refundAmountFieldName != "" {
			if refundAmountValue, ok := item[refundAmountFieldName]; ok && refundAmountValue != "" {
				refundAmountStr := strings.ReplaceAll(refundAmountValue.(string), ",", "")
				if refundAmountFloat, err := strconv.ParseFloat(refundAmountStr, 64); err == nil {
					refundAmount = int32(refundAmountFloat*100 + 0.5) // 元转分，四舍五入
				}
			}
		}

		// 达人名称（可选）
		var talentName string
		if talentNameFieldName != "" {
			if talentNameValue, ok := item[talentNameFieldName]; ok && talentNameValue != "" {
				talentName = talentNameValue.(string)
			}
		}

		// 达人UID（可选）
		var talentUID string
		if talentUIDFieldName != "" {
			if talentUIDValue, ok := item[talentUIDFieldName]; ok && talentUIDValue != "" {
				talentUID = talentUIDValue.(string)
			}
		}

		// 达人佣金（可选，单位：元，需转换为分）
		var talentCommission int32
		if talentCommissionFieldName != "" {
			if talentCommissionValue, ok := item[talentCommissionFieldName]; ok && talentCommissionValue != "" {
				talentCommissionStr := strings.ReplaceAll(talentCommissionValue.(string), ",", "")
				if talentCommissionFloat, err := strconv.ParseFloat(talentCommissionStr, 64); err == nil {
					talentCommission = int32(talentCommissionFloat*100 + 0.5) // 元转分，四舍五入
				}
			}
		}

		// 如果件数大于1，则需要拆单
		for i := 1; i <= goodNumInt; i++ {
			// 从第1件商品开始就加后缀：-1, -2, -3...
			orderNumber := fmt.Sprintf("%s-%d", orderNumberStr, i)

			// 创建订单对象
			order := &yanxue_model.Order{
				GoodID:            "",
				ChannelGoodID:     channelGoodIdStr,
				ChannelID:         channelId,
				OrderPrice:        float32(orderPriceFloat / float64(goodNumInt)),
				Ph:                ph,
				Status:            status,
				OrderNumber:       orderNumber,
				OriginOrderNumber: orderNumberStr,
				PaymentTime:       paymentTime,
				UpdatedBy:         adminId,
				ServiceStatus:     string(constant.OrderStatusPending),
			}

			// 赋值可选字段（只有非零值才赋值）
			if receiptAmount > 0 {
				order.ReceiptAmount = receiptAmount / int32(goodNumInt) // 平分
			}
			if discountAmount > 0 {
				order.DiscountAmount = discountAmount / int32(goodNumInt) // 平分
			}
			if platformFee > 0 {
				order.PlatformFee = platformFee / int32(goodNumInt) // 平分
			}
			if !refundTime.IsZero() {
				order.RefundTime = refundTime
			}
			if refundAmount > 0 {
				order.RefundAmount = refundAmount / int32(goodNumInt) // 平分
			}
			if talentName != "" {
				order.TalentName = talentName
			}
			if talentUID != "" {
				order.TalentUID = talentUID
			}
			if talentCommission > 0 {
				order.TalentCommission = talentCommission / int32(goodNumInt) // 平分
			}

			orderDataDBList = append(orderDataDBList, order)
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
		return reply, errorx.DataSQLErr.WithError(err).Err()
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
			s.log.Errorf("ImportOrderInfoByCsvFile: 查询平台商品失败, err=%v", err)
			// 不影响导入流程，继续执行
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

			s.log.Infof("ImportOrderInfoByCsvFile: 成功获取 %d 个商品的类型信息", len(goodIdToTypeMap))
		}
	}
	orderNumberToItemMap := make(map[string]*yanxue_model.Order)
	// 查询数据是否已存在
	orderDBList, err := s.orderRepo.FindMultiByOrderNumbers(ctx, orderNumberList)
	if err != nil {
		return reply, errorx.DataSQLErr.WithError(err).Err()
	}
	for _, order := range orderDBList {
		orderNumberToItemMap[order.OrderNumber] = order
	}
	var needCreateOrderList []*yanxue_model.Order
	var needUpdateOrderList []*yanxue_model.Order
	needUpdateOrderIdToOldOrderMap := make(map[string]*yanxue_model.Order)
	for _, order := range orderDataDBList {
		order.GoodID = channelGoodIdToGoodIdMap[order.ChannelGoodID]
		if order.GoodID == "" {
			return reply, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("商品渠道ID:%s 对应商品不存在！", order.ChannelGoodID))
		}

		// 赋值商品类型
		if goodIdToTypeMap != nil {
			if goodType, exists := goodIdToTypeMap[order.GoodID]; exists && goodType != "" {
				order.GoodType = goodType
				s.log.Infof("ImportOrderInfoByCsvFile: 订单 %s 赋值商品类型为 %s", order.OrderNumber, goodType)
			} else {
				s.log.Warnf("ImportOrderInfoByCsvFile: 订单 %s 未找到商品类型, goodId=%s", order.OrderNumber, order.GoodID)
			}
		}

		if _, ok := orderNumberToItemMap[order.OrderNumber]; !ok {
			// 不存在则新增
			needCreateOrderList = append(needCreateOrderList, order)
		} else {
			// 存在，并且新状态大于等于旧状态，则更新
			oldOrder := orderNumberToItemMap[order.OrderNumber]
			if constant.OrderStatusRankMap[order.Status] >= constant.OrderStatusRankMap[oldOrder.Status] {
				// 手机号不能变
				order.ID = oldOrder.ID
				order.Ph = oldOrder.Ph
				needUpdateOrderList = append(needUpdateOrderList, order)
				needUpdateOrderIdToOldOrderMap[order.ID] = oldOrder
			}
		}
	}
	err = s.orderRepo.CreateBatchCache(ctx, needCreateOrderList, 200)
	if err != nil {
		return reply, errorx.DataSQLErr.WithError(err).Err()
	}
	// 并发更新父订单和子订单
	wg := &sync.WaitGroup{}
	wg.Add(len(needUpdateOrderList))
	for _, order := range needUpdateOrderList {
		go func(order *yanxue_model.Order) {
			defer wg.Done()
			// 更新父订单
			s.orderRepo.UpdateOneCache(context.Background(), order, needUpdateOrderIdToOldOrderMap[order.ID])

			// 同步更新子订单
			s.syncUpdateSubOrders(context.Background(), order, needUpdateOrderIdToOldOrderMap[order.ID])
		}(order)
	}
	wg.Wait()

	// 8. 拆分子订单
	// 收集所有需要拆单的订单ID（新创建的订单 + 更新的订单）
	var orderIdsToSplit []string
	for _, order := range needCreateOrderList {
		if order.ID != "" {
			orderIdsToSplit = append(orderIdsToSplit, order.ID)
		}
	}
	for _, order := range needUpdateOrderList {
		if order.ID != "" {
			orderIdsToSplit = append(orderIdsToSplit, order.ID)
		}
	}

	s.log.Infof("ImportOrderInfoByCsvFile: 开始拆分子订单，共 %d 个父订单需要拆单", len(orderIdsToSplit))

	// 并发拆单
	splitWg := &sync.WaitGroup{}
	splitWg.Add(len(orderIdsToSplit))
	for _, orderId := range orderIdsToSplit {
		go func(orderId string) {
			defer splitWg.Done()
			err := s.SplitOrderToSubOrders(context.Background(), orderId)
			if err != nil {
				s.log.Errorf("ImportOrderInfoByCsvFile: 拆单失败，orderId=%s, err=%v", orderId, err)
			} else {
				s.log.Infof("ImportOrderInfoByCsvFile: 拆单成功，orderId=%s", orderId)
			}
		}(orderId)
	}
	splitWg.Wait()

	s.log.Infof("ImportOrderInfoByCsvFile: 子订单拆分完成")

	// 如果存在不存在系统的商品，则需要报错提示
	var goodNameList []string
	for goodId := range notExistGoodIdMap {
		goodNameList = append(goodNameList, channelGoodIdToNameMap[goodId])
	}
	if len(goodNameList) > 0 {
		s.log.Warnf("商品:%s未在系统注册，有%d条相关订单导入失败。", strings.Join(goodNameList, "，"), skipImportOrderNums)
		return reply, errors.New(http.StatusOK, "-1", fmt.Sprintf("商品:%s未在系统注册，有%d条相关订单导入失败。", strings.Join(goodNameList, "，"), skipImportOrderNums))
	}
	return reply, nil
}

// syncUpdateSubOrders 同步更新子订单
// 当父订单更新时，同步更新其所有子订单的所有字段（除了特定的标识字段）
func (s *ShadowV1OrderUseCase) syncUpdateSubOrders(ctx context.Context, newOrder *yanxue_model.Order, oldOrder *yanxue_model.Order) {
	// 查询该父订单的所有子订单
	subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, newOrder.ID)
	if err != nil {
		s.log.Errorf("syncUpdateSubOrders: 查询子订单失败, parentOrderId=%s, err=%v", newOrder.ID, err)
		return
	}

	if len(subOrders) == 0 {
		s.log.Infof("syncUpdateSubOrders: 父订单没有子订单, parentOrderId=%s", newOrder.ID)
		return
	}

	s.log.Infof("syncUpdateSubOrders: 开始同步更新子订单, parentOrderId=%s, 子订单数量=%d", newOrder.ID, len(subOrders))

	subOrderCount := int32(len(subOrders))

	// 计算需要平分的金额字段（使用父订单的新值）
	// OrderPrice 需要平分（父订单单位：元，子订单单位：分，需要转换）
	orderPriceInCents := int32(newOrder.OrderPrice*100 + 0.5) // 元转分，四舍五入
	avgOrderPrice := orderPriceInCents / subOrderCount
	// 以下金额字段都需要平分（单位：分）
	avgReceiptAmount := newOrder.ReceiptAmount / subOrderCount
	avgDiscountAmount := newOrder.DiscountAmount / subOrderCount
	avgPlatformFee := newOrder.PlatformFee / subOrderCount
	avgRefundAmount := newOrder.RefundAmount / subOrderCount
	avgTalentCommission := newOrder.TalentCommission / subOrderCount
	avgPlatformDiscountAmount := newOrder.PlatformDiscountAmount / subOrderCount
	avgPaymentDiscountAmount := newOrder.PaymentDiscountAmount / subOrderCount
	avgShopDiscountAmount := newOrder.ShopDiscountAmount / subOrderCount
	avgActualInsured := newOrder.ActualInsured / subOrderCount

	// 并发更新所有子订单
	subWg := &sync.WaitGroup{}
	subWg.Add(len(subOrders))
	for i, subOrder := range subOrders {
		go func(index int, subOrder *yanxue_model.SubOrder) {
			defer subWg.Done()

			oldSubOrder := s.subOrderRepo.DeepCopy(subOrder)

			// ========== 同步所有字段（除了特定的标识字段）==========

			// 1. 基本信息字段（直接同步）
			subOrder.GoodID = newOrder.GoodID
			subOrder.ChannelGoodID = newOrder.ChannelGoodID
			subOrder.ChannelID = newOrder.ChannelID
			subOrder.Ph = newOrder.Ph
			subOrder.Status = newOrder.Status
			subOrder.PaymentTime = newOrder.PaymentTime
			subOrder.ServiceStatus = newOrder.ServiceStatus
			subOrder.GoodType = newOrder.GoodType

			// 2. 金额字段（平分，最后一个子订单补齐差额）
			if index == len(subOrders)-1 {
				// 最后一个子订单补齐差额
				subOrder.OrderPrice = orderPriceInCents - (avgOrderPrice * (subOrderCount - 1))
				subOrder.ReceiptAmount = newOrder.ReceiptAmount - (avgReceiptAmount * (subOrderCount - 1))
				subOrder.DiscountAmount = newOrder.DiscountAmount - (avgDiscountAmount * (subOrderCount - 1))
				subOrder.PlatformFee = newOrder.PlatformFee - (avgPlatformFee * (subOrderCount - 1))
				subOrder.RefundAmount = newOrder.RefundAmount - (avgRefundAmount * (subOrderCount - 1))
				subOrder.TalentCommission = newOrder.TalentCommission - (avgTalentCommission * (subOrderCount - 1))
				subOrder.PlatformDiscountAmount = newOrder.PlatformDiscountAmount - (avgPlatformDiscountAmount * (subOrderCount - 1))
				subOrder.PaymentDiscountAmount = newOrder.PaymentDiscountAmount - (avgPaymentDiscountAmount * (subOrderCount - 1))
				subOrder.ShopDiscountAmount = newOrder.ShopDiscountAmount - (avgShopDiscountAmount * (subOrderCount - 1))
				subOrder.ActualInsured = newOrder.ActualInsured - (avgActualInsured * (subOrderCount - 1))
			} else {
				// 其他子订单平分
				subOrder.OrderPrice = avgOrderPrice
				subOrder.ReceiptAmount = avgReceiptAmount
				subOrder.DiscountAmount = avgDiscountAmount
				subOrder.PlatformFee = avgPlatformFee
				subOrder.RefundAmount = avgRefundAmount
				subOrder.TalentCommission = avgTalentCommission
				subOrder.PlatformDiscountAmount = avgPlatformDiscountAmount
				subOrder.PaymentDiscountAmount = avgPaymentDiscountAmount
				subOrder.ShopDiscountAmount = avgShopDiscountAmount
				subOrder.ActualInsured = avgActualInsured
			}

			// 3. 退款相关字段（直接同步）
			subOrder.RefundTime = newOrder.RefundTime
			subOrder.RefundID = newOrder.RefundID
			subOrder.RefundReason = newOrder.RefundReason

			// 4. 达人相关字段（直接同步）
			subOrder.TalentName = newOrder.TalentName
			subOrder.TalentUID = newOrder.TalentUID

			// 5. 支付相关字段（直接同步）
			subOrder.PayID = newOrder.PayID
			subOrder.PaymentDeadline = newOrder.PaymentDeadline

			// 6. 优惠券相关字段（直接同步）
			subOrder.UserCouponID = newOrder.UserCouponID

			// 7. 课程预约相关字段（直接同步）
			subOrder.CourseAppointmentDraft = newOrder.CourseAppointmentDraft

			// 8. 备注字段（直接同步）
			subOrder.ParentRemark = newOrder.ParentRemark

			// 9. 券ID字段（直接同步）
			subOrder.CertificateID = newOrder.CertificateID

			// 10. 操作人字段（直接同步）
			subOrder.UpdatedBy = newOrder.UpdatedBy

			// 注意：以下字段不同步，保持子订单自己的值
			// - ID（子订单自己的ID）
			// - OrderNumber（子订单自己的订单号）
			// - ParentOrderID（父订单ID，不能改）
			// - OriginOrderNumber（原始订单号，保持不变）
			// - CreatedAt（创建时间，不能改）
			// - UpdatedAt（更新时间，由数据库自动更新）

			// 执行更新
			err := s.subOrderRepo.UpdateOneCache(context.Background(), subOrder, oldSubOrder)
			if err != nil {
				s.log.Errorf("syncUpdateSubOrders: 更新子订单失败, subOrderId=%s, err=%v", subOrder.ID, err)
				return
			}

			s.log.Infof("syncUpdateSubOrders: 更新子订单成功, subOrderId=%s, subOrderNumber=%s", subOrder.ID, subOrder.OrderNumber)
		}(i, subOrder)
	}

	subWg.Wait()

	s.log.Infof("syncUpdateSubOrders: 子订单同步更新完成, parentOrderId=%s", newOrder.ID)
}

// formatDateStandardString 将日期字符串转换为"xx-xx-xx xx:xx"格式
func formatDateStandardString(dateStr string) string {
	// 优化：将常见的时间格式都尝试解析，并统一格式化为"xx-xx-xx xx:xx:xx"
	var t time.Time
	var err error

	// 常见的时间格式，包含日期和时间的各种组合
	formats := []string{
		"2006-01-02 15:04:05",
		"2006/01/02 15:04:05",
		"2006.01.02 15:04:05",
		"2006年01月02日 15:04:05",
		"2006-01-02 15:04",
		"2006/01/02 15:04",
		"2006.01.02 15:04",
		"2006年01月02日 15:04",
		"2006-01-02",
		"2006/01/02",
		"2006.01.02",
		"2006年01月02日",
		"01-02-2006 15:04:05",
		"01/02/2006 15:04:05",
		"01-02-2006 15:04",
		"01/02/2006 15:04",
		"01-02-2006",
		"01/02/2006",
		"02-01-2006 15:04:05",
		"02/01/2006 15:04:05",
		"02-01-2006 15:04",
		"02/01/2006 15:04",
		"02-01-2006",
		"02/01/2006",
		"20060102",
		"20060102 15:04:05",
		"20060102 15:04",
		"2006-1-2 15:4:5",
		"2006/1/2 15:4:5",
		"2006-1-2",
		"2006/1/2",
	}

	// 预处理：去除前后空格
	dateStr = strings.TrimSpace(dateStr)

	// 处理特殊格式如 2025/4/6、2025-4-6、2025.4.6
	re := regexp.MustCompile(`^(\d{4})[\/\.\-年](\d{1,2})[\/\.\-月](\d{1,2})[日]?(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$`)
	if re.MatchString(dateStr) {
		matches := re.FindStringSubmatch(dateStr)
		year := matches[1]
		month := matches[2]
		day := matches[3]
		hour := "00"
		minute := "00"
		second := "00"
		if len(matches) > 4 && matches[4] != "" {
			hour = fmt.Sprintf("%02s", matches[4])
		}
		if len(matches) > 5 && matches[5] != "" {
			minute = fmt.Sprintf("%02s", matches[5])
		}
		if len(matches) > 6 && matches[6] != "" {
			second = fmt.Sprintf("%02s", matches[6])
		}
		// 补全月日
		if len(month) == 1 {
			month = "0" + month
		}
		if len(day) == 1 {
			day = "0" + day
		}
		dateStr = fmt.Sprintf("%s-%s-%s %s:%s:%s", year, month, day, hour, minute, second)
		// 直接用标准格式解析
		t, err = time.Parse("2006-01-02 15:04:05", dateStr)
		if err == nil {
			return t.Format("2006-01-02 15:04:05")
		}
	}

	// 依次尝试所有格式
	for _, format := range formats {
		t, err = time.Parse(format, dateStr)
		if err == nil {
			return t.Format("2006-01-02 15:04:05")
		}
	}

	// 如果无法解析，返回原始字符串
	return dateStr
}
