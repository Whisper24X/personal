package constant

type ContextWithValueKey string

// header 字段
const (
	XMdSn            = "x-md-sn"
	XMdIp            = "x-md-ip"
	XMdUseragent     = "x-md-useragent"
	XMdAdminId       = "x-md-admin-id"
	XMdAdminUsername = "x-md-admin-user-name"
	XMdOnionUserId   = "x-md-onion-user-id"
	XMdUserId        = "x-md-user-id"
)

const (
	TemplateValidStatus        = 1
	TemplateInvalidStatus      = -1
	SubjectDisplayName         = "主题"
	ContractInfoImportTaskType = "contractInfoImport"
)

const (
	AsyncTaskStatusPending = 0
	AsyncTaskStatusRunning = 1
	AsyncTaskStatusSuccess = 2
	AsyncTaskStatusFailed  = 3
)

const (
	ESignFileUploadSuccess  = 2
	ESignFileConvertSuccess = 5
)

const (
	ContractStatusDraft    = 0 // 草稿
	ContractStatusSigning  = 1 // 签署中
	ContractStatusFinished = 2 // 已完成
	ContractStatusRevoke   = 3 // 已撤销
)

var ContractStatusMap = map[int]string{
	ContractStatusDraft:    "草稿",
	ContractStatusSigning:  "签署中",
	ContractStatusFinished: "已完成",
	ContractStatusRevoke:   "已撤销",
}

const (
	OperationTypeAddNewTemplate            = "新增模版"
	OperationTypeUpdateTemplate            = "更新模版"
	OperationTypeChangeTemplateStatus      = "修改模版状态"
	OperationTypeCreateCoupon              = "新增优惠券"
	OperationTypePutOnCoupon               = "上架优惠券"
	OperationTypePutOffCoupon              = "下架优惠券"
	OperationTypeOrderUpdatePhone          = "修改手机号"
	OperationTypeOrderUpdateStatus         = "修改订单状态"
	OperationTypeOrderUpdateStatusToRefund = "转为已退款"
	OperationTypeOrderRefund               = "操作退款"
)

const (
	ModuleTypeCoupon           = "优惠券"
	ModuleTypeContractTemplate = "合同模版"
	ModuleTypeOrder            = "订单"
)
const (
	ChannelTypeDY                = "抖音"
	ChannelTypeWD                = "微店"
	ChannelTypeXCX               = "小程序"
	ChannelTypeSPHXD             = "视频号小店"
	MappingTypeField             = "field"
	MappingTypeEnum              = "enum"
	MappingTypeServiceStatusEnum = "serviceStatusEnum"
)

var OrderStatusToName = map[string]string{
	OrderStatusPending.String():         "待预约",
	OrderStatusSuccess.String():         "已预约",
	OrderStatusCompleted.String():       "已完成",
	OrderStatusRefunded.String():        "已退款",
	OrderStatusPendingPayment.String():  "待付款",
	OrderStatusClosed.String():          "交易关闭",
	OrderStatusPartialRefunded.String(): "部分退款",
}

var NewOrderStatusToName = map[string]string{
	OrderStatusPending.String():         "支付成功",
	OrderStatusRefunded.String():        "已退款",
	OrderStatusClosed.String():          "交易关闭",
	OrderStatusPendingPayment.String():  "待付款",
	OrderStatusRefunding.String():       "退款中",
	OrderStatusFailedRefund.String():    "退款失败",
	OrderStatusPartialRefunded.String(): "部分退款",
}

var ServiceStatusToName = map[string]string{
	OrderStatusPending.String():   "待预约",
	OrderStatusSuccess.String():   "已预约",
	OrderStatusCompleted.String(): "已出行",
}

var OrderStatusRankMap = map[string]int32{
	OrderStatusPending.String():         0,
	OrderStatusSuccess.String():         1,
	OrderStatusCompleted.String():       2,
	OrderStatusPartialRefunded.String(): 3,
	OrderStatusRefunded.String():        4,
	OrderStatusPendingPayment.String():  5,
	OrderStatusClosed.String():          6,
}

var CourseAppointmentStatusToName = map[string]string{
	CourseAppointmentStatusCancel.String():    "取消预约",
	CourseAppointmentStatusSuccess.String():   "已预约",
	CourseAppointmentStatusCompleted.String(): "已完成",
}

const (
	ContractTypeSingleDay    = 1 // 单日营
	ContractTypeMultiDay     = 2 // 多日营
	ContractTypeSingleDayStr = "单日营"
	ContractTypeMultiDayStr  = "多日营"
)

const (
	PartyASealPositionKeyword = "甲方（营员家长）签字"
	PartyBSealPositionKeyword = "乙方（盖章）"
	PartyCSealPositionKeyword = "丙方（盖章）"
)

var StudentSexToName = map[string]string{
	StudentSexM.String(): "男",
	StudentSexF.String(): "女",
}

var ParentAccompanyToName = map[string]string{
	ParentAccompanyYes.String():     "是",
	ParentAccompanyNo.String():      "否",
	ParentAccompanyUnknown.String(): "未知",
}

const (
	ContractStatusPending = "pending"
	ContractStatusPushed  = "pushed"
)

const CertificateStatusRefund = 301

const DouYinAccountId = "7384734808737433641"

const (
	OrderStatusFinish          = 1
	OrderStatusPaySuccess      = 200
	OrderStatusAvailable       = 201
	OrderStatusPartPay         = 150
	WeiDianOrderRefundStatus   = 2
	WeiDianOrderUnPayStatusStr = "unpay" // 未支付
	WeiDianOrderCloseStatusStr = "close" // 已关闭
	TransactionTypePay         = "货款"
	TransactionTypeRefund      = "退款"
)

var (
	ValidStatus   = 1
	InvalidStatus = -1
)
