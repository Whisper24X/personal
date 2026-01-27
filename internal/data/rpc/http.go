package rpc

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-resty/resty/v2"
	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkcore "github.com/larksuite/oapi-sdk-go/v3/core"
	larkim "github.com/larksuite/oapi-sdk-go/v3/service/im/v1"

	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

func NewHttpRpc(logger log.Logger, restyClient *resty.Client) *HttpRpc {
	l := log.NewHelper(log.With(logger, "module", "data/rpc"), log.WithMessageKey("message"))
	return &HttpRpc{
		log:         l,
		restyClient: restyClient,
	}
}

type HttpRpc struct {
	log         *log.Helper
	restyClient *resty.Client
}

func (d *HttpRpc) GetDouYinAccessToken(ctx context.Context) (string, error) {
	url := "https://open.douyin.com/oauth/client_token/"
	GetAccessTokenReqBody := map[string]string{
		"client_key":    "awdxdr2sy4qqhnhj",
		"client_secret": "59877ba9a0c05cafb6752dd4c9286beb",
		"grant_type":    "client_credential",
	}
	type GetAccessTokenResponse struct {
		Data struct {
			AccessToken string `json:"access_token"`
			Captcha     string `json:"captcha"`
			DescURL     string `json:"desc_url"`
			Description string `json:"description"`
			ErrorCode   int    `json:"error_code"`
			ExpiresIn   int    `json:"expires_in"`
			LogID       string `json:"log_id"`
		} `json:"data"`
		Message string `json:"message"`
	}
	reply := &GetAccessTokenResponse{}
	tokenResp, err := d.restyClient.R().SetContext(ctx).SetBody(GetAccessTokenReqBody).Post(url)
	if err != nil {
		d.log.WithContext(ctx).Errorf("DouYin GetAccessToken failed err: %v,", err)
		return "", err
	}
	if tokenResp.StatusCode() != http.StatusOK {
		d.log.WithContext(ctx).Errorf("DouYin GetAccessToken NotStatusOK StatusCode:%d resp: %s", tokenResp.StatusCode(), tokenResp.String())
		return "", err
	}
	if tokenResp.Body() == nil {
		return "", nil
	}
	err = jsonutil.Unmarshal(tokenResp.Body(), reply)
	if err != nil {
		return "", errorx.DataFormattingError.WithError(err).Err()
	}
	token := reply.Data.AccessToken
	return token, nil
}

func (d *HttpRpc) GetWeiDianAccessToken(ctx context.Context) (string, error) {
	url := "https://oauth.open.weidian.com/token"
	GetAccessTokenReqBody := map[string]string{
		"appkey":     "3703033372",
		"secret":     "2553940284612ef02a770928c8ff242d",
		"grant_type": "client_credential",
	}
	type GetAccessTokenResponse struct {
		Result struct {
			AccessToken string `json:"access_token"`
			ExpireIn    int64  `json:"expire_in"` // 使用int64避免大数值溢出
		} `json:"result"`

		Status struct {
			StatusCode   int    `json:"status_code"`
			StatusReason string `json:"status_reason"`
		} `json:"status"`
	}

	reply := &GetAccessTokenResponse{}
	tokenResp, err := d.restyClient.R().SetContext(ctx).SetQueryParams(GetAccessTokenReqBody).Get(url)
	if err != nil {
		d.log.WithContext(ctx).Errorf("WeiDian GetAccessToken failed err: %v,", err)
		return "", err
	}
	if tokenResp.StatusCode() != http.StatusOK {
		d.log.WithContext(ctx).Errorf("WeiDian GetAccessToken NotStatusOK StatusCode:%d resp: %s", tokenResp.StatusCode(), tokenResp.String())
		return "", err
	}
	if tokenResp.Body() == nil {
		return "", nil
	}
	err = jsonutil.Unmarshal(tokenResp.Body(), reply)
	if err != nil {
		return "", errorx.DataFormattingError.WithError(err).Err()
	}
	token := reply.Result.AccessToken
	return token, nil
}

type QueryDouYinOrderInfoReply struct {
	Data struct {
		Orders []struct {
			Certificate []struct {
				CertificateId  string `json:"certificate_id"`
				CombinationId  string `json:"combination_id"`
				ItemStatus     int    `json:"item_status"` // 券状态：301：已退款
				ItemUpdateTime int    `json:"item_update_time"`
				OrderItemId    string `json:"order_item_id"`
				RefundAmount   int    `json:"refund_amount"`
				RefundTime     int    `json:"refund_time"`
			} `json:"certificate"` // 券信息
			OrderStatus    int32  `json:"order_status"`    // 订单状态
			SkuName        string `json:"sku_name"`        // 抖音的商品名称
			SkuId          string `json:"sku_id"`          // 抖音的商品ID
			OrderId        string `json:"order_id"`        // 订单ID
			OrderType      int32  `json:"order_type"`      // 订单类型
			Count          int32  `json:"count"`           // 该订单包含的券的数量
			ReceiptAmount  int32  `json:"receipt_amount"`  // 实收金额
			DiscountAmount int32  `json:"discount_amount"` // 优惠金额
			AnchorId       int64  `json:"anchor_id"`       // 达人ID
		} `json:"orders"`
		Page struct {
			PageNum  int `json:"page_num"`
			PageSize int `json:"page_size"`
			Total    int `json:"total"`
		} `json:"page"`
	} `json:"data"`
}

type QueryDouYinOrderInfoReqParams struct {
	AccountId   string
	OrderId     string
	OrderStatus int
	PageNum     int
	PageSize    int
}

func (d *HttpRpc) QueryDouYinOrderInfo(ctx context.Context, params *QueryDouYinOrderInfoReqParams) (*QueryDouYinOrderInfoReply, error) {
	reply := &QueryDouYinOrderInfoReply{}
	accessToken, err := d.GetDouYinAccessToken(ctx)
	if err != nil {
		return reply, err
	}
	url := "https://open.douyin.com/goodlife/v1/trade/order/query/"
	queryParams := map[string]string{
		"account_id": params.AccountId,
	}
	if params.PageNum != 0 {
		pageNum := strconv.Itoa(params.PageNum)
		queryParams["page_num"] = pageNum
	}
	if params.PageSize != 0 {
		pageSize := strconv.Itoa(params.PageSize)
		queryParams["page_size"] = pageSize
	}
	if params.OrderId != "" {
		queryParams["order_id"] = params.OrderId
	}
	headers := map[string]string{
		"access-token": accessToken,
		"content-type": "application/json",
	}
	resp, err := d.restyClient.R().SetContext(ctx).SetHeaders(headers).SetQueryParams(queryParams).EnableTrace().SetResult(reply).Get(url)
	if err != nil || resp.StatusCode() != http.StatusOK {
		return reply, errorx.APIInternalErr.WithError(err).Err()
	}
	return reply, nil
}

type QueryWeiDianOrderListReqParams struct {
	PageNum   int    `json:"page_num"`
	PageSize  int    `json:"page_size"`
	OrderType string `json:"order_type"`
	AddStart  string `json:"add_start"`
	AddEnd    string `json:"add_end"`
}

type WeiDianPublicParams struct {
	Method      string `json:"method"`
	AccessToken string `json:"access_token"`
	Version     string `json:"version"`
}
type QueryWeiDianOrderListReply struct {
	Status struct {
		StatusCode   int    `json:"status_code"`
		StatusReason string `json:"status_reason"`
	} `json:"status"`
	Result struct {
		OrderNum int `json:"order_num"`
		Orders   []struct {
			OrderId      string `json:"order_id"`
			RefundStatus int    `json:"refundStatus"`
			Status       int    `json:"status"`
			Total        string `json:"total"`
		} `json:"orders"`
		TotalNum int `json:"total_num"`
	} `json:"result"`
}

func (d *HttpRpc) QueryWeiDianOrderList(ctx context.Context, params *QueryWeiDianOrderListReqParams, accessToken string) (*QueryWeiDianOrderListReply, error) {
	reply := &QueryWeiDianOrderListReply{}
	url := "https://api.vdian.com/api"
	paramsJson, err := jsonutil.Marshal(params)
	if err != nil {
		return reply, errorx.DataFormattingError.WithError(err).Err()
	}
	publicParams := &WeiDianPublicParams{
		Method:      "vdian.order.list.get",
		AccessToken: accessToken,
		Version:     "1.5",
	}
	publicParamsJson, err := jsonutil.Marshal(publicParams)
	if err != nil {
		return reply, errorx.DataFormattingError.WithError(err).Err()
	}
	queryParams := map[string]string{
		"param":  string(paramsJson),
		"public": string(publicParamsJson),
	}
	headers := map[string]string{
		"content-type": "application/json",
	}
	resp, err := d.restyClient.R().SetContext(ctx).SetHeaders(headers).SetQueryParams(queryParams).EnableTrace().SetResult(reply).Get(url)
	if err != nil || resp.StatusCode() != http.StatusOK {
		return reply, errorx.APIInternalErr.WithError(err).Err()
	}
	return reply, nil
}

type QueryWeiDianOrderDetailReqParams struct {
	OrderId string `json:"order_id"`
}

type QueryWeiDianOrderDetailReply struct {
	Status struct {
		StatusCode   int    `json:"status_code"`
		StatusReason string `json:"status_reason"`
	} `json:"status"`
	Result struct {
		OrderID       string `json:"order_id"`
		Status        string `json:"status"`
		StatusDesc    string `json:"status_desc"`
		StatusOri     string `json:"status_ori"`
		AddTime       string `json:"add_time"`
		PayTime       string `json:"pay_time"`
		SendTime      string `json:"send_time"`
		Price         string `json:"price"`
		Total         string `json:"total"`
		ExpressFee    string `json:"express_fee"`
		LastIncome    string `json:"last_income"` // 最后收入
		PlatFee       string `json:"plat_fee"`
		Quantity      string `json:"quantity"`
		PayType       string `json:"pay_type"`
		OrderType     string `json:"order_type"`
		OrderTypeDesc string `json:"order_type_des"`
		Items         []struct {
			ItemID     string `json:"item_id"`   // 商品ID
			ItemName   string `json:"item_name"` // 商品名称
			Price      string `json:"price"`
			Quantity   string `json:"quantity"`    // 商品数量
			TotalPrice string `json:"total_price"` // 订单总价
			SkuID      string `json:"sku_id"`
			SkuTitle   string `json:"sku_title"`
			Img        string `json:"img"`
			URL        string `json:"url"`
			RefundInfo struct {
				RefundFee string `json:"refund_fee"` // 退款金额
				RefundNo  string `json:"refund_no"`  // 退款单号
			} `json:"refund_info"`
		} `json:"items"`
		BuyerInfo struct {
			Phone string `json:"phone"` // 联系方式
		} `json:"buyer_info"`
	} `json:"result"`
}

func (d *HttpRpc) QueryWeiDianOrderDetail(ctx context.Context, params *QueryWeiDianOrderDetailReqParams, accessToken string) (*QueryWeiDianOrderDetailReply, error) {
	reply := &QueryWeiDianOrderDetailReply{}
	url := "https://api.vdian.com/api"
	paramsJson, err := jsonutil.Marshal(params)
	if err != nil {
		return reply, errorx.DataFormattingError.WithError(err).Err()
	}
	publicParams := &WeiDianPublicParams{
		Method:      "vdian.order.get",
		AccessToken: accessToken,
		Version:     "1.0",
	}
	publicParamsJson, err := jsonutil.Marshal(publicParams)
	if err != nil {
		return reply, errorx.DataFormattingError.WithError(err).Err()
	}
	queryParams := map[string]string{
		"param":  string(paramsJson),
		"public": string(publicParamsJson),
	}
	headers := map[string]string{
		"content-type": "application/json",
	}
	resp, err := d.restyClient.R().SetContext(ctx).SetHeaders(headers).SetQueryParams(queryParams).EnableTrace().SetResult(reply).Get(url)
	if err != nil || resp.StatusCode() != http.StatusOK {
		return reply, errorx.APIInternalErr.WithError(err).Err()
	}
	return reply, nil
}

// QueryWeiDianRefundDetailReq 微店 API 1072 请求参数
// 接口文档: https://open.weidian.com/#/api/1072
type QueryWeiDianRefundDetailReq struct {
	RefundNo string `json:"refundNo,omitempty"`
}

type QueryWeiDianRefundDetailReply struct {
	Status struct {
		StatusCode   int    `json:"status_code"`
		StatusReason string `json:"status_reason"`
	} `json:"status"`
	Result struct {
		RefundBasicInfo struct {
			RefundNo   string `json:"refundNo"`   // 退款单号
			FinishTime int64  `json:"finishTime"` // 退款时间
		} `json:"refundBasicInfo"`
	} `json:"result"`
}

// QueryWeiDianRefundDetail 调用微店 API 1072
// 接口文档: https://open.weidian.com/#/api/1072
func (d *HttpRpc) QueryWeiDianRefundDetail(ctx context.Context, params *QueryWeiDianRefundDetailReq, accessToken string) (*QueryWeiDianRefundDetailReply, error) {
	reply := &QueryWeiDianRefundDetailReply{}
	url := "https://api.vdian.com/api"

	paramsJson, err := jsonutil.Marshal(params)
	if err != nil {
		return reply, errorx.DataFormattingError.WithError(err).Err()
	}

	publicParams := &WeiDianPublicParams{
		Method:      "open.sellerQueryRefundDetail",
		AccessToken: accessToken,
		Version:     "1.0",
	}

	publicParamsJson, err := jsonutil.Marshal(publicParams)
	if err != nil {
		return reply, errorx.DataFormattingError.WithError(err).Err()
	}

	queryParams := map[string]string{
		"param":  string(paramsJson),
		"public": string(publicParamsJson),
	}

	headers := map[string]string{
		"content-type": "application/json",
	}

	resp, err := d.restyClient.R().SetContext(ctx).SetHeaders(headers).SetQueryParams(queryParams).EnableTrace().SetResult(reply).Get(url)
	if err != nil || resp.StatusCode() != http.StatusOK {
		d.log.Errorf("调用QueryWeiDianRefundDetail 失败, err=%v, statusCode=%d", err, resp.StatusCode())
		return reply, errorx.APIInternalErr.WithError(err).Err()
	}

	// 检查响应状态
	if reply.Status.StatusCode != 0 {
		d.log.Errorf("微店QueryWeiDianRefundDetail返回错误, statusCode=%d, statusReason=%s",
			reply.Status.StatusCode, reply.Status.StatusReason)
		return reply, errorx.APIInternalErr.Err()
	}

	return reply, nil
}

type GetFeiShuTenantAccessTokenReply struct {
	Code              int32  `json:"code"`
	Msg               string `json:"msg"`
	TenantAccessToken string `json:"tenantAccessToken"`
	Expire            int64  `json:"expire"`
}

func (d *HttpRpc) GetFeiShuTenantAccessToken(ctx context.Context) (string, error) {
	reply := &GetFeiShuTenantAccessTokenReply{}
	url := "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
	queryParams := map[string]string{
		"app_id":     "cli_9f3d0502023e500c",
		"app_secret": "PFhtffj3aOKCYynGAszm9l1X3OMi1Apl",
	}
	headers := map[string]string{
		"Content-Type": "application/json; charset=utf-8",
	}
	resp, err := d.restyClient.R().SetContext(ctx).SetHeaders(headers).SetQueryParams(queryParams).EnableTrace().SetResult(reply).Get(url)
	if err != nil || resp.StatusCode() != http.StatusOK {
		return "", errorx.APIInternalErr.WithError(err).Err()
	}

	return reply.TenantAccessToken, nil
}

func (d *HttpRpc) FeiShuUploadImage(ctx context.Context, r *http.Request) (string, error) {
	var client = lark.NewClient("cli_9f3d0502023e500c", "PFhtffj3aOKCYynGAszm9l1X3OMi1Apl")
	file, _, err := r.FormFile("image")
	if err != nil {
		d.log.Errorf("Missing or invalid image file:", err.Error())
		return "", errorx.ParamErr.WithError(err).Err()
	}
	defer file.Close()

	// 创建请求对象
	req := larkim.NewCreateImageReqBuilder().
		Body(larkim.NewCreateImageReqBodyBuilder().
			ImageType(`message`).
			Image(file).
			Build()).
		Build()

	// 发起请求
	resp, err := client.Im.V1.Image.Create(context.Background(), req)

	// 处理错误
	if err != nil {
		return "", errorx.APIThirdErr.WithError(err).Err()
	}

	// 服务端错误处理
	if !resp.Success() {
		d.log.Errorf("logId: %s, error response: \n%s", resp.RequestId(), larkcore.Prettify(resp.CodeError))
		return "", nil
	}

	return *resp.Data.ImageKey, nil
}

// QueryDouYinSettleInfoReqParams 查询抖音分账信息请求参数
type QueryDouYinSettleInfoReqParams struct {
	OutOrderNo  string // 开发者侧订单 id
	OutSettleNo string // 开发者侧分账单 id
	OrderId     string // 抖音开平侧订单 id
	SettleId    string // 抖音开平侧分账单 id
}

// QueryDouYinSettleInfoReply 查询抖音分账信息响应
type QueryDouYinSettleInfoReply struct {
	Data []struct {
		OutOrderNo   string `json:"out_order_no"`  // 开发者侧交易订单 id
		OutSettleNo  string `json:"out_settle_no"` // 开发者侧分账单 id
		OrderId      string `json:"order_id"`      // 抖音开平侧交易订单 id
		SettleId     string `json:"settle_id"`     // 抖音开平侧分账单id
		SettleAmount int64  `json:"settle_amount"` // 分账金额，单位分
		SettleStatus string `json:"settle_status"` // 分账状态：INIT：初始化 PROCESSING：处理中 SUCCESS：处理成功 FAIL：处理失败
		SettleDetail string `json:"settle_detail"` // 分账详情
		SettleTime   int64  `json:"settle_time"`   // 分账时间，13 位时间戳，单位毫秒
		Rake         int64  `json:"rake"`          // 手续费，单位分
		Commission   int64  `json:"commission"`    // 佣金，单位分
		CpExtra      string `json:"cp_extra"`      // 开发者自定义透传字段
	} `json:"data"`
	Extra struct {
		ErrorCode      int    `json:"error_code"`
		Description    string `json:"description"`
		SubErrorCode   int    `json:"sub_error_code"`
		SubDescription string `json:"sub_description"`
		Logid          string `json:"logid"`
		Now            int64  `json:"now"`
	} `json:"extra"`
}

// QueryDouYinSettleInfo 查询抖音分账信息
func (d *HttpRpc) QueryDouYinSettleInfo(ctx context.Context, params *QueryDouYinSettleInfoReqParams) (*QueryDouYinSettleInfoReply, error) {
	reply := &QueryDouYinSettleInfoReply{}

	// 获取 access_token
	accessToken, err := d.GetDouYinAccessToken(ctx)
	if err != nil {
		return reply, err
	}

	url := "https://open.douyin.com/api/apps/trade/v2/settle/query_settle"

	// 构建请求体
	requestBody := make(map[string]string)
	if params.OutOrderNo != "" {
		requestBody["out_order_no"] = params.OutOrderNo
	}
	if params.OutSettleNo != "" {
		requestBody["out_settle_no"] = params.OutSettleNo
	}
	if params.OrderId != "" {
		requestBody["order_id"] = params.OrderId
	}
	if params.SettleId != "" {
		requestBody["settle_id"] = params.SettleId
	}

	headers := map[string]string{
		"access-token": accessToken,
		"Content-Type": "application/json",
	}

	resp, err := d.restyClient.R().
		SetContext(ctx).
		SetHeaders(headers).
		SetBody(requestBody).
		SetResult(reply).
		Post(url)

	if err != nil || resp.StatusCode() != http.StatusOK {
		d.log.Errorf("查询抖音分账信息失败, err=%v, statusCode=%d", err, resp.StatusCode())
		return reply, errorx.APIInternalErr.WithError(err).Err()
	}

	// 检查业务错误码
	if reply.Extra.ErrorCode != 0 {
		d.log.Errorf("查询抖音分账信息业务错误, errorCode=%d, description=%s",
			reply.Extra.ErrorCode, reply.Extra.Description)
		return reply, errorx.APIInternalErr.Err()
	}

	return reply, nil
}

// QueryDouYinCertificateReqParams 查询抖音券状态请求参数
type QueryDouYinCertificateReqParams struct {
	AccountId             string // 核销商户根账户ID（云连锁场景接入需传入，其余场景可不传）
	EncryptedCode         string // 验券准备接口返回的加密券码（与OrderId二选一必传）
	OrderId               string // 订单id（与EncryptedCode二选一必传）
	RpcTransitLifeAccount string // 来客商户根账户ID（可选）
}

// QueryDouYinCertificateReply 查询抖音券状态响应
type QueryDouYinCertificateReply struct {
	Data struct {
		Certificates []struct {
			Code            string `json:"code"`              // 券码
			Status          int    `json:"status"`            // 券状态
			UsedStatusType  int    `json:"used_status_type"`  // 使用状态类型
			CanVerifyStatus int    `json:"can_verify_status"` // 可核销状态
			ExpireTime      int64  `json:"expire_time"`       // 过期时间
			StartTime       int64  `json:"start_time"`        // 开始时间
			Amount          struct {
				PayAmount              int64 `json:"pay_amount"`               // 支付金额（单位：分）
				PlatformDiscountAmount int64 `json:"platform_discount_amount"` // 平台优惠金额（单位：分）
				PaymentDiscountAmount  int64 `json:"payment_discount_amount"`  // 支付优惠金额（单位：分）
			} `json:"amount"` // 金额信息
			PayBillInfo struct {
				BillTotalAmount int64 `json:"bill_total_amount"` // 账单总金额（单位：分）
				BillAmount      int64 `json:"bill_amount"`       // 账单金额（单位：分）
			} `json:"pay_bill_info"` // 支付账单信息
		} `json:"certificates"` // 券信息列表
		ErrorCode   int    `json:"error_code"`  // 错误码
		Description string `json:"description"` // 错误描述
	} `json:"data"`
}

// QueryDouYinCertificate 查询抖音券状态
// 接口文档: https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/general-capabilities/life.capacity.fulfilment/certificate.query
func (d *HttpRpc) QueryDouYinCertificate(ctx context.Context, params *QueryDouYinCertificateReqParams) (*QueryDouYinCertificateReply, error) {
	reply := &QueryDouYinCertificateReply{}

	// 获取 access_token
	accessToken, err := d.GetDouYinAccessToken(ctx)
	if err != nil {
		return reply, err
	}

	url := "https://open.douyin.com/goodlife/v1/fulfilment/certificate/query/"

	// 构建查询参数
	queryParams := make(map[string]string)
	if params.AccountId != "" {
		queryParams["account_id"] = params.AccountId
	}
	if params.EncryptedCode != "" {
		queryParams["encrypted_code"] = params.EncryptedCode
	}
	if params.OrderId != "" {
		queryParams["order_id"] = params.OrderId
	}

	// 验证参数：encrypted_code 和 order_id 二选一必传
	if params.EncryptedCode == "" && params.OrderId == "" {
		d.log.Errorf("QueryDouYinCertificate: encrypted_code 和 order_id 二选一必传")
		return reply, errorx.ParamErr.Err()
	}

	// 验证参数：encrypted_code 和 order_id 不能同时传入
	if params.EncryptedCode != "" && params.OrderId != "" {
		d.log.Errorf("QueryDouYinCertificate: encrypted_code 和 order_id 不能同时传入")
		return reply, errorx.ParamErr.Err()
	}

	// 构建请求头
	headers := map[string]string{
		"access-token": accessToken,
		"content-type": "application/json",
	}
	if params.RpcTransitLifeAccount != "" {
		headers["Rpc-Transit-Life-Account"] = params.RpcTransitLifeAccount
	}

	resp, err := d.restyClient.R().
		SetContext(ctx).
		SetHeaders(headers).
		SetQueryParams(queryParams).
		SetResult(reply).
		Get(url)

	if err != nil || resp.StatusCode() != http.StatusOK {
		d.log.Errorf("查询抖音券状态失败, err=%v, statusCode=%d", err, resp.StatusCode())
		return reply, errorx.APIInternalErr.WithError(err).Err()
	}

	// 检查 data 中的错误码
	if reply.Data.ErrorCode != 0 {
		d.log.Errorf("查询抖音券状态数据错误, errorCode=%d, description=%s",
			reply.Data.ErrorCode, reply.Data.Description)
		return reply, errorx.APIInternalErr.Err()
	}

	return reply, nil
}

// QueryDouYinAfterSaleOrderDetailReqParams 查询抖音售后单详情请求参数
type QueryDouYinAfterSaleOrderDetailReqParams struct {
	AccountId     string // 抖音来客商家根账户 ID（必填）
	OrderId       string // 抖音生活服务订单ID（必填）
	CertificateId string // 券id（可选）
}

// QueryDouYinAfterSaleOrderDetailReply 查询抖音售后单详情响应
type QueryDouYinAfterSaleOrderDetailReply struct {
	Data struct {
		ErrorCode          int    `json:"error_code"`  // 错误码，0为成功
		Description        string `json:"description"` // 错误码描述
		HasMore            bool   `json:"has_more"`    // 是否还有更多数据
		Cursor             string `json:"cursor"`      // 游标，用于分页
		AfterSaleOrderList []struct {
			AfterSaleId           string `json:"after_sale_id"`            // 售后单ID
			OutBizAfterSaleId     string `json:"out_biz_after_sale_id"`    // 外部业务售后单ID
			OrderId               string `json:"order_id"`                 // 订单ID
			OutRefundPaymentId    string `json:"out_refund_payment_id"`    // 外部退款支付ID
			Status                int    `json:"status"`                   // 售后单状态
			RefundType            int64  `json:"refund_type"`              // 退款类型
			OrderType             int64  `json:"order_type"`               // 订单类型
			TradeType             int64  `json:"trade_type"`               // 交易类型
			RefundAmount          int64  `json:"refund_amount"`            // 退款金额，单位分
			UserRefundAmount      int64  `json:"user_refund_amount"`       // 用户退款金额，单位分
			MarketRefundAmount    int64  `json:"market_refund_amount"`     // 市场退款金额，单位分
			UserDeductFeeAmount   int64  `json:"user_deduct_fee_amount"`   // 用户扣除手续费金额，单位分
			MarketDeductFeeAmount int64  `json:"market_deduct_fee_amount"` // 市场扣除手续费金额，单位分
			DeductFeeAmount       int64  `json:"deduct_fee_amount"`        // 扣除手续费金额，单位分
			TotalRefundAmount     int64  `json:"total_refund_amount"`      // 总退款金额，单位分
			RealRefundAmount      int64  `json:"real_refund_amount"`       // 实际退款金额，单位分
			MerchantAccountId     int64  `json:"merchant_account_id"`      // 商户账户ID
			AuditResult           string `json:"audit_result"`             // 审核结果
			AuditTime             int64  `json:"audit_time"`               // 审核时间，13位毫秒时间戳
			CreateTime            int64  `json:"create_time"`              // 创建时间，秒级时间戳
			UpdateTime            int64  `json:"update_time"`              // 更新时间，秒级时间戳
			CompleteTime          int64  `json:"complete_time"`            // 完成时间，秒级时间戳
			Reason                struct {
				ReasonCode []int64 `json:"reason_code"` // 原因代码列表
				Desc       string  `json:"desc"`        // 原因描述
				ShowReason []struct {
					ReasonCode int64  `json:"reason_code"` // 显示原因代码
					Msg        string `json:"msg"`         // 显示原因消息
				} `json:"show_reason"` // 显示原因列表
			} `json:"reason"` // 退款原因
			RejectReason   string `json:"reject_reason"` // 拒绝原因
			RefundInfoList []struct {
				RefundId                string `json:"refund_id"`                // 退款单ID
				CertificateId           string `json:"certificate_id"`           // 券ID
				OrderItemId             string `json:"order_item_id"`            // 订单项ID
				Code                    string `json:"code"`                     // 券码
				RefundStatus            int    `json:"refund_status"`            // 退款状态
				IsVerified              bool   `json:"is_verified"`              // 是否已核销
				TotalRefundAmount       int64  `json:"total_refund_amount"`      // 总退款金额，单位分
				UserRefundAmount        int64  `json:"user_refund_amount"`       // 用户退款金额，单位分
				MarketRefundAmount      int64  `json:"market_refund_amount"`     // 市场退款金额，单位分
				UserDeductFeeAmount     int64  `json:"user_deduct_fee_amount"`   // 用户扣除手续费金额，单位分
				MarketDeductFeeAmount   int64  `json:"market_deduct_fee_amount"` // 市场扣除手续费金额，单位分
				DeductFeeAmount         int64  `json:"deduct_fee_amount"`        // 扣除手续费金额，单位分
				RealRefundAmount        int64  `json:"real_refund_amount"`       // 实际退款金额，单位分
				ApplyTime               int64  `json:"apply_time"`               // 申请时间，13位毫秒时间戳
				CreateTime              int64  `json:"create_time"`              // 创建时间，秒级时间戳
				UpdateTime              int64  `json:"update_time"`              // 更新时间，秒级时间戳
				CompleteTime            int64  `json:"complete_time"`            // 完成时间，秒级时间戳
				TimesCardRefundInfoList []struct {
					SerialNumber int64 `json:"serial_number"` // 次卡序列号
				} `json:"times_card_refund_info_list"` // 次卡退款信息列表
			} `json:"refund_info_list"` // 退款信息列表
		} `json:"after_sale_order_list"` // 售后单列表
	} `json:"data"` // 响应数据
	Extra struct {
		ErrorCode      int    `json:"error_code"`
		Description    string `json:"description"`
		SubErrorCode   int    `json:"sub_error_code"`
		SubDescription string `json:"sub_description"`
		Logid          string `json:"logid"`
		Now            int64  `json:"now"`
	} `json:"extra"`
}

// QueryDouYinAfterSaleOrderDetail 查询抖音售后单详情
// 接口文档: https://partner.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/general-capabilities/groupon-refund/after-sale-order-detail
func (d *HttpRpc) QueryDouYinAfterSaleOrderDetail(ctx context.Context, params *QueryDouYinAfterSaleOrderDetailReqParams) (*QueryDouYinAfterSaleOrderDetailReply, error) {
	reply := &QueryDouYinAfterSaleOrderDetailReply{}

	// 获取 access_token
	accessToken, err := d.GetDouYinAccessToken(ctx)
	if err != nil {
		return reply, err
	}

	// 参数校验：account_id 和 order_id 必填
	if params.AccountId == "" {
		d.log.Errorf("QueryDouYinAfterSaleOrderDetail: account_id 必填")
		return reply, errorx.ParamErr.Err()
	}
	if params.OrderId == "" {
		d.log.Errorf("QueryDouYinAfterSaleOrderDetail: order_id 必填")
		return reply, errorx.ParamErr.Err()
	}

	url := "https://open.douyin.com/goodlife/v1/akte/after_sale/order_detail/get/"

	// 构建查询参数
	queryParams := map[string]string{
		"account_id": params.AccountId,
		"order_id":   params.OrderId,
	}
	if params.CertificateId != "" {
		queryParams["certificate_id"] = params.CertificateId
	}

	headers := map[string]string{
		"access-token": accessToken,
		"content-type": "application/json",
	}

	resp, err := d.restyClient.R().
		SetContext(ctx).
		SetHeaders(headers).
		SetQueryParams(queryParams).
		SetResult(reply).
		Get(url)

	if err != nil || resp.StatusCode() != http.StatusOK {
		d.log.Errorf("查询抖音售后单详情失败, err=%v, statusCode=%d", err, resp.StatusCode())
		return reply, errorx.APIInternalErr.WithError(err).Err()
	}

	// 检查 data 中的错误码
	if reply.Data.ErrorCode != 0 {
		d.log.Errorf("查询抖音售后单详情数据错误, errorCode=%d, description=%s",
			reply.Data.ErrorCode, reply.Data.Description)
		return reply, errorx.APIInternalErr.Err()
	}

	return reply, nil
}

// QueryDouYinLedgerRecordByCertReqParams 查询抖音分账明细请求参数
type QueryDouYinLedgerRecordByCertReqParams struct {
	CertificateIds []string // 核销之后返回的券标志（必填）
}

// QueryDouYinLedgerRecordByCertReply 查询抖音分账明细响应
type QueryDouYinLedgerRecordByCertReply struct {
	Data struct {
		ErrorCode   int    `json:"error_code"`  // 错误码，0为成功
		Description string `json:"description"` // 错误码描述
		Records     []struct {
			Cursor        string `json:"cursor"`         // 游标
			LedgerId      string `json:"ledger_id"`      // 分账单ID
			VerifyId      string `json:"verify_id"`      // 核销ID
			CertificateId string `json:"certificate_id"` // 券ID
			OrderId       string `json:"order_id"`       // 订单ID
			VerifyTime    int64  `json:"verify_time"`    // 核销时间，秒级时间戳
			Status        int    `json:"status"`         // 状态
			Code          string `json:"code"`           // 券码
			Amount        struct {
				ActualInsured       int64 `json:"actual_insured"`        // 实际保险金额，单位分
				BenefitAmount       int64 `json:"benefit_amount"`        // 优惠金额，单位分
				BrandFunderSubsidy  int64 `json:"brand_funder_subsidy"`  // 品牌资助补贴，单位分
				DeductionDiscount   int64 `json:"deduction_discount"`    // 扣减折扣，单位分
				LedgerTotal         int64 `json:"ledger_total"`          // 分账总额，单位分
				MerchantTicket      int64 `json:"merchant_ticket"`       // 商家优惠，单位分
				Original            int64 `json:"original"`              // 原价，单位分
				Pay                 int64 `json:"pay"`                   // 支付金额，单位分
				PayDiscount         int64 `json:"pay_discount"`          // 支付折扣，单位分
				PurchaseFee         int64 `json:"purchase_fee"`          // 采购费用，单位分
				TotalOperationAgent int64 `json:"total_operation_agent"` // 总运营代理，单位分
				WelfareDonation     int64 `json:"welfare_donation"`      // 福利捐赠，单位分
				ZlbPromotionFee     int64 `json:"zlb_promotion_fee"`     // 直连宝推广费用，单位分
			} `json:"amount"` // 金额信息
			FundAmount struct {
				BenefitAmount                     int64 `json:"benefit_amount"`                        // 优惠金额，单位分
				BrandPayMerchantServiceCommission int64 `json:"brand_pay_merchant_service_commission"` // 品牌支付商家服务佣金，单位分
				Goods                             int64 `json:"goods"`                                 // 商品金额，单位分
				PayHandling                       int64 `json:"pay_handling"`                          // 支付手续费，单位分
				ProxyCommission                   int64 `json:"proxy_commission"`                      // 代理佣金，单位分
				PurchaseFee                       int64 `json:"purchase_fee"`                          // 采购费用，单位分
				TalentCommission                  int64 `json:"talent_commission"`                     // 达人佣金，单位分
				TotalAgentMerchant                int64 `json:"total_agent_merchant"`                  // 总代理商家，单位分
				TotalCommission                   int64 `json:"total_commission"`                      // 总佣金，单位分
				TotalMerchantPlatformService      int64 `json:"total_merchant_platform_service"`       // 软件服务费，单位分
			} `json:"fund_amount"` // 资金金额信息
			Sku struct {
				MarketPrice   int64  `json:"market_price"`    // 市场价格，单位分
				SkuId         string `json:"sku_id"`          // SKU ID
				SoldStartTime int64  `json:"sold_start_time"` // 开售时间，秒级时间戳
				ThirdSkuId    string `json:"third_sku_id"`    // 第三方SKU ID
				Title         string `json:"title"`           // 商品标题
			} `json:"sku"` // SKU信息
		} `json:"records"` // 分账明细记录列表
	} `json:"data"` // 响应数据
	Extra struct {
		ErrorCode      int    `json:"error_code"`      // 错误码
		Description    string `json:"description"`     // 错误描述
		SubErrorCode   int    `json:"sub_error_code"`  // 子错误码
		SubDescription string `json:"sub_description"` // 子错误描述
		Logid          string `json:"logid"`           // 日志ID
		Now            int64  `json:"now"`             // 当前时间戳
	} `json:"extra"` // 额外信息
}

// QueryDouYinLedgerRecordByCert 查询抖音分账明细
// 接口文档: https://partner.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/general-capabilities/life.capacity.billing/ledger.query-record-by-cert
func (d *HttpRpc) QueryDouYinLedgerRecordByCert(ctx context.Context, params *QueryDouYinLedgerRecordByCertReqParams) (*QueryDouYinLedgerRecordByCertReply, error) {
	reply := &QueryDouYinLedgerRecordByCertReply{}

	// 获取 access_token
	accessToken, err := d.GetDouYinAccessToken(ctx)
	if err != nil {
		return reply, err
	}

	// 参数校验：certificate_ids 必填且不能为空
	if len(params.CertificateIds) == 0 {
		d.log.Errorf("QueryDouYinLedgerRecordByCert: certificate_ids 必填且不能为空")
		return reply, errorx.ParamErr.Err()
	}

	url := "https://open.douyin.com/goodlife/v1/settle/ledger/query_record_by_cert/"

	// 构建查询参数
	// certificate_ids 是数组参数，需要转换为逗号分隔的字符串
	certificateIdsStr := strings.Join(params.CertificateIds, ",")
	queryParams := map[string]string{
		"certificate_ids": certificateIdsStr,
	}

	headers := map[string]string{
		"access-token": accessToken,
		"content-type": "application/json",
	}

	resp, err := d.restyClient.R().
		SetContext(ctx).
		SetHeaders(headers).
		SetQueryParams(queryParams).
		SetResult(reply).
		Get(url)

	if err != nil || resp.StatusCode() != http.StatusOK {
		d.log.Errorf("查询抖音分账明细失败, err=%v, statusCode=%d", err, resp.StatusCode())
		return reply, errorx.APIInternalErr.WithError(err).Err()
	}

	// 检查 extra 中的错误码
	if reply.Extra.ErrorCode != 0 {
		d.log.Errorf("查询抖音分账明细业务错误, errorCode=%d, description=%s, subErrorCode=%d, subDescription=%s",
			reply.Extra.ErrorCode, reply.Extra.Description, reply.Extra.SubErrorCode, reply.Extra.SubDescription)
		return reply, errorx.APIInternalErr.Err()
	}

	// 检查 data 中的错误码
	if reply.Data.ErrorCode != 0 {
		d.log.Errorf("查询抖音分账明细数据错误, errorCode=%d, description=%s",
			reply.Data.ErrorCode, reply.Data.Description)
		return reply, errorx.APIInternalErr.Err()
	}

	return reply, nil
}
