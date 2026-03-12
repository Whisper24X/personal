package biz

import (
	"context"
	"net/http"
	"time"

	"github.com/FrancisLv/PowerWeChat/v3/src/kernel/models"
	notifyRequest "github.com/FrancisLv/PowerWeChat/v3/src/payment/notify/request"
	orderResponse "github.com/FrancisLv/PowerWeChat/v3/src/payment/order/response"
	refundResponse "github.com/FrancisLv/PowerWeChat/v3/src/payment/refund/response"
	jwts "github.com/golang-jwt/jwt"
	"github.com/google/wire"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	shadowV1 "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/jwt"
)

// ProviderSet is biz providers.
var ProviderSet = wire.NewSet(
	NewShadowV1ChannelUseCase,
	NewShadowV1ContractUseCase,
	NewShadowV1CouponUseCase,
	NewShadowV1CourseAppointmentUseCase,
	NewShadowV1CourseStockUseCase,
	NewShadowV1CourseUseCase,
	NewShadowV1DynamicFieldMappingUseCase,
	NewShadowV1EvaluationTemplateUseCase,
	NewShadowV1EvaluationUseCase,
	NewShadowV1GoodRecommendationCategoryUseCase,
	NewShadowV1GoodUseCase,
	NewShadowV1GrabTicketSiteConfigUseCase,
	NewShadowV1GrabTicketTaskConfigUseCase,
	NewShadowV1OrderUseCase,
	NewShadowV1PlatformGoodUseCase,
	NewShadowV1SubOrderUseCase,
	NewShadowV1SysAdminUseCase,
	NewShadowV1SysAuthUseCase,
	NewShadowV1SysDataLogUseCase,
	NewShadowV1SysDeptUseCase,
	NewShadowV1SysOperationLogUseCase,
	NewShadowV1SysPermissionUseCase,
	NewShadowV1SysRoleUseCase,
	NewShadowV1UserBindStudentUseCase,
	NewShadowV1UserCouponUseCase,
	NewShadowV1UserMessageUseCase,
	NewShadowV1UserOperationLogUseCase,
	NewShadowV1UserUseCase,
	NewShadowV1UserWxUseCase,
	NewWechatV1CouponUseCase,
	NewWechatV1CourseUseCase,
	NewWechatV1EvaluationTemplateUseCase,
	NewWechatV1EvaluationUseCase,
	NewWechatV1GoodRecommendationCategoryUseCase,
	NewWechatV1GoodUseCase,
	NewWechatV1OrderUseCase,
	NewWechatV1UserBindStudentUseCase,
	NewWechatV1UserCouponUseCase,
	NewWechatV1UserUseCase,
	NewWechatV1WxXcxQrcodeUseCase,
)

type CommonRepo interface {
	AutoLock(ctx context.Context, key string, ttl time.Duration, fn func() error) error
	AutoLockRetry(ctx context.Context, key string, ttl time.Duration, fn func() error) error
	LockOnce(ctx context.Context, key string, ttl time.Duration, fn func() error) error
	Transaction(ctx context.Context, fn func(tx *yanxue_dao.Query) error) error
	ClearCache(ctx context.Context) error
}

type BffRepo interface {
	QueryAndUploadCSV(ctx context.Context, key string, filePath string, fn func() ([][]string, error)) (string, error)
	FindAdminCanViewDeptIds(ctx context.Context, adminId string) ([]string, error)
	FindAdminCanViewStoreIds(ctx context.Context, adminId string) ([]string, error)
	FindAdminCanViewAdminIds(ctx context.Context, adminId string) ([]string, error)
	FindMultiAdminsRoleAndDept(ctx context.Context, sysAdmins []*yanxue_model.SysAdmin) ([]*shadowV1.SysAdminInfo, error)
	CheckCourseAppointment(ctx context.Context, order *yanxue_model.Order, good *yanxue_model.Good, courseAppointment *yanxue_model.CourseAppointment) error
	FinishOrderItem(ctx context.Context, orderId string) error
	CancelOrder(ctx context.Context, orderId string) error
}

type SysAdminRepo interface {
	yanxue_repo.ISysAdminRepo
	DTO(sysAdmin *yanxue_model.SysAdmin) (*shadowV1.SysAdminInfo, error)
	GenerateJwTToken(ctx context.Context, kv map[string]interface{}) (*jwt.Token, error)
	CheckJwtTokenCheck(ctx context.Context, token string) (jwts.MapClaims, error)
	ExpiredToken(ctx context.Context, adminIds []string) error
	AdminIdToName(ctx context.Context, adminIds []string) (map[string]string, error)
}

type SysRoleRepo interface {
	yanxue_repo.ISysRoleRepo
	GetDataPermissionPriority(ctx context.Context, data []*yanxue_model.SysRole) (constant.SysRoleDataPermissionType, error)
}
type SysPermissionRepo interface {
	yanxue_repo.ISysPermissionRepo
	BuildTree(sysPermissions []*yanxue_model.SysPermission, showAll bool) []*shadowV1.SysPermissionInfo
	FindPermissionCurrentAndChildrenIds(ctx context.Context, permissionID string) ([]string, error)
}

type SysAdminDeptRepo interface {
	yanxue_repo.ISysAdminDeptRepo
}

type SysAdminRoleRepo interface {
	yanxue_repo.ISysAdminRoleRepo
}

type SysRolePermissionRepo interface {
	yanxue_repo.ISysRolePermissionRepo
}

type SysDeptRepo interface {
	yanxue_repo.ISysDeptRepo
	BuildTree(sysDepts []*yanxue_model.SysDept, showAll bool, isSelect bool) []*shadowV1.SysDeptInfo
	FindAllDeptIds(ctx context.Context) ([]string, error)
	FindDeptCurrentAndChildrenIds(ctx context.Context, deptIds []string) ([]string, error)
	BuildCanViewTreeWithSelect(ctx context.Context, deptIds []string) ([]*shadowV1.SysDeptInfo, error)
}

type SysOperationLogRepo interface {
	yanxue_repo.ISysOperationLogRepo
}

type UserRepo interface {
	yanxue_repo.IUserRepo
	GenerateJwTToken(ctx context.Context, kv map[string]interface{}) (*jwt.Token, error)
	CheckJwtTokenCheck(ctx context.Context, token string) (jwts.MapClaims, error)
	ExpiredToken(ctx context.Context, adminIds []string) error
	GetDefaultNickName(phone string) string
	SendSmsCode(ctx context.Context, phone, smsCode string) error
	CheckSmsCodeFrequency(ctx context.Context, phone string) error
	SetSmsCodeFrequency(ctx context.Context, phone string) error
	SetSmsCode(ctx context.Context, smsId string, smsCode, phone, userWxId string) error
	CheckSmsCode(ctx context.Context, smsId string, smsCode string) (string, string, error)
}

type UserWxRepo interface {
	yanxue_repo.IUserWxRepo
}
type UserBindStudentRepo interface {
	yanxue_repo.IUserBindStudentRepo
}
type UserMessageRepo interface {
	yanxue_repo.IUserMessageRepo
	SendOfficialOrderRefundSuccessNotice(ctx context.Context, officialAccountOpenId string, orderId, orderNumber, goodName, refundAmount string) error
	SendOfficialOrderPaySuccessNotice(ctx context.Context, officialAccountOpenId string, orderId, orderNumber, goodName, amount, paymentTime string) error
	SendOfficialAccountAppointmentRemindNotice(ctx context.Context, officialAccountOpenId string, orderId, orderNumber, courseName, appointmentTime string) error
}

type EsignRepo interface {
	UploadFile(ctx context.Context, req *UploadFileReq) (string, error)
	UrgeSignFlow(ctx context.Context, signFlowID, psnAccount string) (bool, error)
	RevokeSignFlow(ctx context.Context, signFlowID, revokeReason string) (bool, error)
	SignContract(ctx context.Context, req *UploadFileReq, fileId string) (string, string, error)
	GetSignFlowDetail(ctx context.Context, signFlowID string) (int32, error)
}

type ContractTemplateRepo interface {
	yanxue_repo.IContractTemplateRepo
}

type ContractRecordRepo interface {
	yanxue_repo.IContractRecordRepo
}

type AsyncTaskRepo interface {
	yanxue_repo.IAsyncTaskRepo
}

type GoodRepo interface {
	yanxue_repo.IGoodRepo
	GoodIdToName(ctx context.Context, goodIds []string) (map[string]string, error)
	HasCourseGoodIds(ctx context.Context, courseId string) ([]string, error)
	// PreDeductStock 预扣库存（使用乐观锁，返回是否成功）
	PreDeductStock(ctx context.Context, goodId string, num int32) (bool, error)
	// RollbackStock 回补库存
	RollbackStock(ctx context.Context, goodId string, num int32) error
}

type CourseRepo interface {
	yanxue_repo.ICourseRepo
	DTOShadowCourse(course *yanxue_model.Course) (*shadowV1.CourseInfo, error)
	CourseIdToName(ctx context.Context, courseIds []string) (map[string]string, error)
	CourseIdToIsPushContractRequired(ctx context.Context, courseIds []string) (map[string]bool, error)
}
type CourseStockRepo interface {
	yanxue_repo.ICourseStockRepo
	DTOShadowCourseStock(courseStock *yanxue_model.CourseStock) (*shadowV1.CourseStockInfo, error)
}
type CourseAppointmentRepo interface {
	yanxue_repo.ICourseAppointmentRepo
	DTOShadowCourseAppointment(courseAppointment *yanxue_model.CourseAppointment) (*shadowV1.CourseAppointmentInfo, error)
	DatePeriodToCountByCourseIdDates(ctx context.Context, courseIds []string, dates []string) (map[string]int32, error)
	CreateCourseAppointmentFeiShuNotify(ctx context.Context, appointmentTopic, appointmentTime, appointmentUserName, appointmentPhone, channelOrderNumber string, appointmentCount int32) error
	CourseAppointmentSituationFeiShuNotify(ctx context.Context, notifyData []*CourseAppointmentSituationFeiShuNotifyReq) error
}

type CourseAppointmentSituationFeiShuNotifyReq struct {
	AppointmentTopic string
	Date             string
	Period           string
	AppointmentCount int32
}

type OrderRepo interface {
	yanxue_repo.IOrderRepo
	GetOrderSummaryInfoByGoodIds(ctx context.Context, goodIds []string) (map[string]int32, error)
	OrderIdToOrderNumber(ctx context.Context, orderIds []string) (map[string]string, error)
	CacheWeiDianAccessTokenGet(ctx context.Context) (string, error)
	CacheWeiDianAccessTokenSet(ctx context.Context, accessToken string) error
	OrderRefundFeiShuNotify(ctx context.Context, channelOrderNumber, channel, goodName string, unFinishedAppointmentCount int32) error
	OrderRefundFailedFeiShuNotify(ctx context.Context, channelOrderNumber, channel string) error
	SendRefundCancelAppointmentFeiShuNotify(ctx context.Context, channelOrderNumber string) error
	DouYinOrderCreateFailedFeiShuNotify(ctx context.Context, taskID, errorInfo, taskContent string) error
	MiniProgramPayOrderNotify(ctx context.Context, paymentTime, goodName, actualPrice, paymentPhone string) error
}

type PlatformGoodRepo interface {
	yanxue_repo.IPlatformGoodRepo
	PlatformGoodIdToGoodType(ctx context.Context, goodIds []string) (map[string]string, error)
}

type ChannelRepo interface {
	yanxue_repo.IChannelRepo
	ChannelIdToName(ctx context.Context) (map[string]string, error)
}

type SysDataLogRepo interface {
	yanxue_repo.ISysDataLogRepo
}

type DynamicFieldMappingRepo interface {
	yanxue_repo.IDynamicFieldMappingRepo
	DTOShadowDynamicFieldMapping(dynamicFieldMapping *yanxue_model.DynamicFieldMapping) (*shadowV1.DynamicFieldMappingInfo, error)
	QueryDynamicFieldMappingList(ctx context.Context, req *shadowV1.GetDynamicFieldMappingListReq) ([]*yanxue_model.DynamicFieldMapping, *condition.Reply, error)
}

type UserCloneRepo interface {
}

type EvaluationTemplateRepo interface {
	yanxue_repo.IEvaluationTemplateRepo
}

type EvaluationRepo interface {
	yanxue_repo.IEvaluationRepo
}

type GrabTicketSiteConfigRepo interface {
	yanxue_repo.IGrabTicketSiteConfigRepo
	ScanCodeForGrabTicketFeiShuNotify(ctx context.Context, content, imgKey string) error
}

type GrabTicketTaskConfigRepo interface {
	yanxue_repo.IGrabTicketTaskConfigRepo
}

type GoodRecommendationCategoryRepo interface {
	yanxue_repo.IGoodRecommendationCategoryRepo
}

type WxXcxQrcodeRepo interface {
	yanxue_repo.IWxXcxQrcodeRepo
}

type CouponRepo interface {
	yanxue_repo.ICouponRepo
}

type UserCouponRepo interface {
	yanxue_repo.IUserCouponRepo
	CountByCouponID(ctx context.Context, couponIds []string, status string) (map[string]int64, error)
}

type WechatPayRepo interface {
	// CreateWechatPayOrder 生成微信支付订单
	CreateWechatPayOrder(ctx context.Context, openID string, outTradeNo string, amount int, description string) (string, error)
	// GetWechatPayOrderJSSDKBridgeConfig 获取JSSDK桥接配置
	GetWechatPayOrderJSSDKBridgeConfig(ctx context.Context, prepayID string) (string, error)
	// GetWechatPayOrderInfoByOutTradeNo 根据商户订单号查询微信支付订单信息
	GetWechatPayOrderInfoByOutTradeNo(ctx context.Context, outTradeNo string) (*orderResponse.ResponseOrder, error)
	// GetWechatPayOrderInfoByTransactionID 根据微信支付订单号查询微信支付订单信息
	GetWechatPayOrderInfoByTransactionID(ctx context.Context, transactionID string) (*orderResponse.ResponseOrder, error)
	// WechatPayPaidNotify 支付-支付回调通知
	WechatPayPaidNotify(wr http.ResponseWriter, ht *http.Request, fn func(message *notifyRequest.RequestNotify, transaction *models.Transaction, fail func(message string)) interface{})
	// WechatPayRefund 退款接口
	WechatPayRefund(ctx context.Context, transactionID, outRefundNo string, totalAmount, refundAmount int, reason string) (string, error)
	// WechatPayRefundQuery 退款查询接口
	WechatPayRefundQuery(ctx context.Context, outRefundNo string) (*refundResponse.ResponseRefund, error)
	// WechatPayRefundNotify 支付-退款回调通知
	WechatPayRefundNotify(wr http.ResponseWriter, ht *http.Request, fn func(message *notifyRequest.RequestNotify, transaction *models.Refund, fail func(message string)) interface{})
	// WechatPayDownloadTradeBill 申请交易订单
	WechatPayDownloadTradeBill(ctx context.Context, billDate string) (string, error)
	// ParseWechatPayBillFromCSV 从CSV文件中解析微信支付账单
	ParseWechatPayBillFromCSV(ctx context.Context, filePath string) ([]*yanxue_model.WechatPayBill, error)
}

type WechatPayBillRepo interface {
	yanxue_repo.IWechatPayBillRepo
	// FindListByTradeTimeRange 根据交易时间范围查询账单列表
	FindListByTradeTimeRange(ctx context.Context, startTime, endTime time.Time) ([]*yanxue_model.WechatPayBill, error)
}

type SubOrderRepo interface {
	yanxue_repo.ISubOrderRepo
}
