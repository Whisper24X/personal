package data

import (
	"context"
	"encoding/csv"
	"fmt"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"net/http"
	"os"
	"strings"

	"github.com/ArtisanCloud/PowerLibs/v3/object"
	"github.com/FrancisLv/PowerWeChat/v3/src/kernel/models"
	"github.com/FrancisLv/PowerWeChat/v3/src/kernel/power"
	billResponse "github.com/FrancisLv/PowerWeChat/v3/src/payment/bill/response"
	notifyRequest "github.com/FrancisLv/PowerWeChat/v3/src/payment/notify/request"
	"github.com/FrancisLv/PowerWeChat/v3/src/payment/order/request"
	"github.com/FrancisLv/PowerWeChat/v3/src/payment/order/response"
	refundRequest "github.com/FrancisLv/PowerWeChat/v3/src/payment/refund/request"
	refundResponse "github.com/FrancisLv/PowerWeChat/v3/src/payment/refund/response"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/spf13/cast"

	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.WechatPayRepo = (*WechatPayRepo)(nil)

func NewWechatPayRepo(
	logger log.Logger,
	data *Data,
) biz.WechatPayRepo {
	l := log.NewHelper(log.With(logger, "module", "data/wechatPay"), log.WithMessageKey("message"))
	return &WechatPayRepo{
		log:  l,
		data: data,
	}
}

type WechatPayRepo struct {
	log  *log.Helper
	data *Data
}

// CreateWechatPayOrder 生成微信支付订单
// openID 用户的openid
// outTradeNo 商户订单号
// amount 金额，单位为分
// description 商品描述
func (r *WechatPayRepo) CreateWechatPayOrder(ctx context.Context, openID string, outTradeNo string, amount int, description string) (string, error) {
	options := &request.RequestJSAPIPrepay{
		Amount: &request.JSAPIAmount{
			Total:    amount, // 金额，单位为分
			Currency: "CNY",  // 货币类型
		},
		Description: description, // 商品描述 127个字符以内
		OutTradeNo:  outTradeNo,  // 这里是商户订单号，不能重复提交给微信 32位字符串
		Payer: &request.JSAPIPayer{
			OpenID: openID, // 用户的openid， 记得也是动态的。
		},
	}
	// 如果需要覆盖掉全局的notify_url
	options.SetNotifyUrl(r.data.cfg.WechatPay.PayNotifyURL)
	// 下单
	response, err := r.data.xcxWechatPayClient.Order.JSAPITransaction(ctx, options)
	if err != nil {
		return "", err
	}
	return response.PrepayID, nil
}

// getJSSDKBridgeConfig 获取JSSDK桥接配置
// http://powerwechat.artisan-cloud.com/zh/payment/jssdk.html
// prepayID 预支付ID
func (r *WechatPayRepo) GetWechatPayOrderJSSDKBridgeConfig(ctx context.Context, prepayID string) (string, error) {
	response, err := r.data.xcxWechatPayClient.JSSDK.BridgeConfig(prepayID, true)
	if err != nil {
		return "", err
	}
	return cast.ToString(response), nil
}

// GetWechatPayOrderInfoByOutTradeNo 根据商户订单号查询微信支付订单信息
func (r *WechatPayRepo) GetWechatPayOrderInfoByOutTradeNo(ctx context.Context, outTradeNo string) (*response.ResponseOrder, error) {
	response, err := r.data.xcxWechatPayClient.Order.QueryByOutTradeNumber(ctx, outTradeNo)
	if err != nil {
		return nil, err
	}
	return response, nil
}

// GetWechatPayOrderInfoByTransactionID 根据微信支付订单号查询微信支付订单信息
func (r *WechatPayRepo) GetWechatPayOrderInfoByTransactionID(ctx context.Context, transactionID string) (*response.ResponseOrder, error) {
	response, err := r.data.xcxWechatPayClient.Order.QueryByTransactionId(ctx, transactionID)
	if err != nil {
		return nil, err
	}
	return response, nil
}

// WechatPayPaidNotify 支付-支付回调通知
// http://powerwechat.artisan-cloud.com/zh/payment/notification.html 支付通知文档
func (r *WechatPayRepo) WechatPayPaidNotify(wr http.ResponseWriter, ht *http.Request, fn func(message *notifyRequest.RequestNotify, transaction *models.Transaction, fail func(message string)) interface{}) {
	res, err := r.data.xcxWechatPayClient.HandlePaidNotify(ht, fn)
	// 这里可能是因为不是微信官方调用的，无法正常解析出transaction和message，所以直接抛错。
	if err != nil {
		r.log.Errorf("WechatPayPaidNotify HandlePaidNotify err: %v", err)
		return
	}
	// 这里根据之前返回的是true或者fail，框架这边自动会帮你回复微信
	err = res.Write(wr)
	if err != nil {
		r.log.Errorf("WechatPayPaidNotify res.Write err: %v", err)
	}
}

// WechatPayRefund 退款接口
// http://powerwechat.artisan-cloud.com/zh/payment/refund.html
// transactionID 微信支付订单号
// outRefundNo 商户退款单号
// totalAmount 订单总金额，单位：分
// refundAmount 退款金额，单位：分
// reason 退款原因
func (r *WechatPayRepo) WechatPayRefund(ctx context.Context, transactionID, outRefundNo string, totalAmount, refundAmount int, reason string) (string, error) {
	options := &refundRequest.RequestRefund{
		TransactionID: transactionID,
		OutRefundNo:   outRefundNo,
		Reason:        reason,
		NotifyUrl:     r.data.cfg.WechatPay.RefundNotifyURL, // 异步接收微信支付退款结果通知的回调地址
		Amount: &refundRequest.RefundAmount{
			Refund:   refundAmount,                        // 退款金额，单位：分
			Total:    totalAmount,                         // 订单总金额，单位：分
			From:     []*refundRequest.RefundAmountFrom{}, // 退款出资账户及金额。不传仍然需要这个空数组防止微信报错
			Currency: "CNY",                               // 货币类型
		},
		GoodsDetail: nil,
	}
	response, err := r.data.xcxWechatPayClient.Refund.Refund(ctx, options)
	if err != nil {
		return "", err
	}
	return response.OutRefundNO, nil
}

// WechatPayRefundQuery 退款查询接口
// http://powerwechat.artisan-cloud.com/zh/payment/refund.html
// outRefundNo 商户退款单号
func (r *WechatPayRepo) WechatPayRefundQuery(ctx context.Context, outRefundNo string) (*refundResponse.ResponseRefund, error) {
	response, err := r.data.xcxWechatPayClient.Refund.Query(ctx, outRefundNo)
	if err != nil {
		return nil, err
	}
	return response, nil
}

// WechatPayRefundNotify 支付-退款回调通知
func (r *WechatPayRepo) WechatPayRefundNotify(wr http.ResponseWriter, ht *http.Request, fn func(message *notifyRequest.RequestNotify, transaction *models.Refund, fail func(message string)) interface{}) {
	res, err := r.data.xcxWechatPayClient.HandleRefundedNotify(ht, fn)
	if err != nil {
		r.log.Errorf("WechatPayRefundNotify HandleRefundedNotify err: %v", err)
		return
	}
	err = res.Write(wr)
	if err != nil {
		r.log.Errorf("WechatPayRefundNotify res.Write err: %v", err)
	}
}

// WechatPayGetTradeBill 申请交易订单
// SDK请求方法错误，应该是POST，写成GET，手戳一个
func (r *WechatPayRepo) WechatPayGetTradeBill(ctx context.Context, date string, billType string, tarType string) (*billResponse.ResponseBillGet, error) {
	result := &billResponse.ResponseBillGet{}

	params := &object.StringMap{
		"bill_date": date,
		"bill_type": billType,
		//"tar_type":  tarType,
	}
	endpoint := r.data.xcxWechatPayClient.Bill.Wrap("/v3/bill/tradebill")
	_, err := r.data.xcxWechatPayClient.Bill.Request(ctx, endpoint, params, http.MethodGet, &object.HashMap{}, false, nil, result)
	return result, err
}

// WechatPayDownloadTradeBill 下载交易订单
// https://pay.weixin.qq.com/doc/v3/merchant/4013071227
// billDate: 账单日期，格式yyyy-MM-DD；
func (r *WechatPayRepo) WechatPayDownloadTradeBill(ctx context.Context, billDate string) (string, error) {
	// 申请交易订单
	response, err := r.WechatPayGetTradeBill(ctx, billDate, "ALL", "")
	if err != nil {
		return "", err
	}
	// 下载文件到本地
	filePath := "./" + billDate + ".csv"
	totalSize, err := r.data.xcxWechatPayClient.Bill.DownloadBill(ctx, &power.RequestDownload{
		HashType:    response.HashType,
		HashValue:   response.HashValue,
		DownloadURL: response.DownloadURL,
	}, filePath)
	if err != nil {
		return "", err
	}

	r.log.Infof("WechatPayDownloadTradeBill totalSize: %d", totalSize)
	return filePath, nil
}

// ParseWechatPayBillFromCSV 从CSV文件中解析微信支付账单
// filePath: CSV文件路径
// 返回: WechatPayBill数组
func (r *WechatPayRepo) ParseWechatPayBillFromCSV(ctx context.Context, filePath string) ([]*yanxue_model.WechatPayBill, error) {
	// 处理后删除文件
	defer os.Remove(filePath)
	// 打开CSV文件
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开CSV文件失败: %w", err)
	}
	defer file.Close()

	// 创建CSV读取器
	reader := csv.NewReader(file)
	reader.LazyQuotes = true       // 允许宽松的引号处理
	reader.FieldsPerRecord = -1    // 允许每行的字段数不一致
	reader.TrimLeadingSpace = true // 去除字段前的空格

	// 读取所有行
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("读取CSV文件失败: %w", err)
	}

	// 检查文件是否为空
	if len(records) < 2 {
		return nil, fmt.Errorf("CSV文件数据不足")
	}

	// 解析表头，建立列名到索引的映射
	headerRow := records[0]
	columnIndexMap := make(map[string]int)
	for i, columnName := range headerRow {
		// 去除反引号、空格和可能的BOM标记
		cleanName := strings.TrimSpace(strings.Trim(columnName, "`"))
		// 去除UTF-8 BOM（可能出现在文件开头）
		cleanName = strings.TrimPrefix(cleanName, "\ufeff")
		// 去除所有不可见字符（包括\r\n\t等）
		cleanName = strings.Map(func(r rune) rune {
			if r == '\r' || r == '\n' || r == '\t' {
				return -1
			}
			return r
		}, cleanName)
		columnIndexMap[cleanName] = i
	}

	// 打印调试信息（帮助排查问题）
	r.log.Debugf("CSV表头列名映射: %+v", columnIndexMap)

	// 验证必需的列是否存在
	requiredColumns := []string{"交易时间", "交易状态", "应结订单金额", "商品名称", "手续费", "微信订单号", "商户订单号", "退款金额"}
	for _, col := range requiredColumns {
		if _, exists := columnIndexMap[col]; !exists {
			// 打印所有可用的列名，帮助调试
			availableColumns := make([]string, 0, len(columnIndexMap))
			for colName := range columnIndexMap {
				availableColumns = append(availableColumns, colName)
			}
			r.log.Errorf("可用的列名: %v", availableColumns)
			return nil, fmt.Errorf("CSV文件缺少必需的列: %s", col)
		}
	}

	// 获取各列的索引
	tradeTimeIdx := columnIndexMap["交易时间"]
	tradeStatusIdx := columnIndexMap["交易状态"]
	amountIdx := columnIndexMap["应结订单金额"]
	goodNameIdx := columnIndexMap["商品名称"]
	handlingFeeIdx := columnIndexMap["手续费"]
	wechatOrderIDIdx := columnIndexMap["微信订单号"]
	orderNumberIdx := columnIndexMap["商户订单号"]
	refundAmountIdx := columnIndexMap["退款金额"]

	// 解析数据行（跳过表头和汇总行）
	var bills []*yanxue_model.WechatPayBill
	for i := 1; i < len(records); i++ {
		record := records[i]

		// 跳过汇总行（检查整行是否包含"总交易单数"等汇总标识）
		isSummaryRow := false
		for _, field := range record {
			cleanField := strings.TrimSpace(strings.Trim(field, "`"))
			if strings.Contains(cleanField, "总交易单数") ||
				strings.Contains(cleanField, "总金额") ||
				strings.Contains(cleanField, "汇总") {
				isSummaryRow = true
				break
			}
		}
		if isSummaryRow {
			r.log.Infof("检测到汇总行，停止解析")
			break
		}

		// 确保记录有足够的列
		maxIdx := 0
		for _, idx := range columnIndexMap {
			if idx > maxIdx {
				maxIdx = idx
			}
		}
		if len(record) <= maxIdx {
			r.log.Warnf("第 %d 行数据列数不足，跳过", i+1)
			continue
		}

		// 解析交易时间（去除反引号）
		tradeTimeStr := strings.Trim(record[tradeTimeIdx], "`")
		tradeTime := timeutil.Carbon().Parse(tradeTimeStr).ToStdTime()
		if tradeTime.IsZero() {
			r.log.Warnf("第 %d 行交易时间解析失败: %s，跳过", i+1, tradeTimeStr)
			continue
		}

		// 交易状态（去除反引号）
		tradeStatus := strings.Trim(record[tradeStatusIdx], "`")

		// 根据交易状态判断收支类型
		transactionType := constant.TransactionTypeRefund
		if tradeStatus == "SUCCESS" {
			transactionType = constant.TransactionTypePay
		}

		// 解析金额（收入是应结订单金额，支出是退款金额，去除反引号）
		amountStr := strings.Trim(record[amountIdx], "`")
		if transactionType == constant.TransactionTypeRefund {
			amountStr = strings.Trim(record[refundAmountIdx], "`")
		}
		amount := cast.ToFloat64(amountStr)
		if transactionType == constant.TransactionTypeRefund {
			amount = -amount
		}

		// 解析手续费（去除反引号）
		handlingFeeStr := strings.Trim(record[handlingFeeIdx], "`")
		handlingFee := cast.ToFloat64(handlingFeeStr)

		// 商品名称（去除反引号）
		goodName := strings.Trim(record[goodNameIdx], "`")

		// 微信订单号（去除反引号）
		wechatOrderID := strings.Trim(record[wechatOrderIDIdx], "`")

		// 商户订单号（订单编号，去除反引号）
		orderNumber := strings.Trim(record[orderNumberIdx], "`")

		// 创建账单对象
		bill := &yanxue_model.WechatPayBill{
			TradeTime:       tradeTime,
			TransactionType: transactionType,
			Amount:          amount,
			GoodName:        goodName,
			HandlingFee:     handlingFee,
			WechatOrderID:   wechatOrderID,
			OrderNumber:     orderNumber,
			ChannelOrderID:  "", // 由外层调用查询后赋值
		}

		bills = append(bills, bill)
	}

	r.log.Infof("从CSV文件解析了 %d 条账单记录", len(bills))
	return bills, nil
}
