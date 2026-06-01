package errorx

import (
	"net/http"

	"gitlab.yc345.tv/backend/yanxue/internal/pkg/errx"
)

var Manager = errx.NewErrorManager(errx.WithI18n(errx.EnUS, EnUSMap))

var (
	InternalServerError = Manager.New(http.StatusInternalServerError, "InternalServerError", "服务崩溃了,请稍后再试")
)

// 参数相关
var (
	ParamBindErr             = Manager.New(http.StatusBadRequest, "ParamBindErr", "参数绑定错误")
	ParamErr                 = Manager.New(http.StatusBadRequest, "ParamErr", "参数错误")
	ParamValidationErr       = Manager.New(http.StatusBadRequest, "ParamValidationErr", "参数验证错误")
	ParamNotJSONRequest      = Manager.New(http.StatusBadRequest, "ParamNotJSONRequest", "参数不是JSON请求")
	ParamHeaderErr           = Manager.New(http.StatusBadRequest, "ParamHeaderErr", "参数Header错误")
	ParamEmojiInvalid        = Manager.New(http.StatusBadRequest, "ParamEmojiInvalid", "名称包含emoji表情")
	ParamIdentityCardInvalid = Manager.New(http.StatusBadRequest, "ParamIdentityCardInvalid", "身份证号格式错误")
	ParamPhoneInvalid        = Manager.New(http.StatusBadRequest, "ParamPhoneInvalid", "手机号格式错误")
)

// Data数据相关
var (
	DataSQLErr          = Manager.New(http.StatusInternalServerError, "DataSQLErr", "数据处理异常(S),请稍后再试")          // 数据库错误
	DataRedisErr        = Manager.New(http.StatusInternalServerError, "DataRedisErr", "数据处理异常(R),请稍后再试")        // redis错误
	DataMQErr           = Manager.New(http.StatusInternalServerError, "DataMQErr", "数据处理异常(M),请稍后再试")           // MQ错误
	DataCompressErr     = Manager.New(http.StatusInternalServerError, "DataCompressErr", "数据处理异常(C),请稍后再试")     // 数据压缩错误
	DataFormattingError = Manager.New(http.StatusInternalServerError, "DataFormattingError", "数据处理异常(F),请稍后再试") // 数据格式化错误
	DataProcessingError = Manager.New(http.StatusInternalServerError, "DataProcessingError", "数据处理异常(P),请稍后再试") // 数据处理错误

	DataRecordNotFound   = Manager.New(http.StatusConflict, "DataRecordNotFound", "数据记录未找到")
	DataDuplicateRecords = Manager.New(http.StatusConflict, "DataDuplicateRecords", "数据重复记录")
	DataEncryptErr       = Manager.New(http.StatusConflict, "DataEncryptErr", "数据加密解密失败")
)

// 请求相关
var (
	RequestCanceledErr = Manager.New(http.StatusConflict, "RequestCanceledErr", "请求取消")
	RequestTimeoutErr  = Manager.New(http.StatusGatewayTimeout, "RequestTimeoutErr", "请求超时")
	RequestFrequentErr = Manager.New(http.StatusConflict, "RequestFrequent", "请求频繁,请稍后再试!!!")
	APIInternalErr     = Manager.New(http.StatusConflict, "APIInternalErr", "请求错误(I),请稍后再试")
	APIThirdErr        = Manager.New(http.StatusConflict, "APIThirdErr", "请求错误(T),请稍后再试")
)

// Token
var (
	TokenJwtConfigNotRequest = Manager.New(http.StatusUnauthorized, "TokenJwtConfigNotRequest", "Jwt配置不存在")
	TokenNotRequest          = Manager.New(http.StatusUnauthorized, "TokenNotRequest", "未携带令牌")
	TokenFormatErr           = Manager.New(http.StatusUnauthorized, "TokenFormatErr", "令牌格式化错误")
	TokenParseErr            = Manager.New(http.StatusUnauthorized, "TokenParseErr", "令牌解析错误")
	TokenInvalid             = Manager.New(http.StatusUnauthorized, "TokenInvalid", "令牌无效")
	TokenExpired             = Manager.New(http.StatusUnauthorized, "TokenExpired", "令牌过期")
	TokenPermissionChanged   = Manager.New(http.StatusUnauthorized, "TokenPermissionChanged", "令牌失效：管理员权限发生变更，请重新登录")
	TokenOtherDeviceLogin    = Manager.New(http.StatusUnauthorized, "TokenOtherDeviceLogin", "令牌失效：其他设备已登录，请重新登录")
	TokenGenerationFailed    = Manager.New(http.StatusUnauthorized, "TokenGenerationFailed", "令牌生成失败")
)

// 账号
var (
	AccountDuplicateName        = Manager.New(http.StatusConflict, "AccountDuplicateName", "帐户名重复")
	AccountNotExist             = Manager.New(http.StatusConflict, "AccountNotExist", "帐户不存在")
	AccountExist                = Manager.New(http.StatusConflict, "AccountExist", "帐户已存在")
	AccountIsLocked             = Manager.New(http.StatusConflict, "AccountIsLocked", "帐号被锁定")
	AccountIsLogout             = Manager.New(http.StatusConflict, "AccountIsLogout", "帐户已注销")
	AccountError                = Manager.New(http.StatusConflict, "AccountError", "帐号错误")
	AccountWrongPassword        = Manager.New(http.StatusConflict, "AccountWrongPassword", "帐号密码错误")
	AccountSamePassword         = Manager.New(http.StatusConflict, "AccountSamePassword", "与上次密码一致")
	AccountOldPasswordErr       = Manager.New(http.StatusConflict, "AccountOldPasswordErr", "旧密码错误")
	AccountIsBanned             = Manager.New(http.StatusConflict, "AccountIsBanned", "帐号被封禁")
	AccountUpdateFailed         = Manager.New(http.StatusConflict, "AccountUpdateFailed", "帐号更新失败")
	AccountDuplicateUsername    = Manager.New(http.StatusConflict, "AccountDuplicateUsername", "重复帐户")
	AccountAbnormalStatus       = Manager.New(http.StatusConflict, "AccountAbnormalStatus", "帐户异常状态")
	AccountNicknameViolation    = Manager.New(http.StatusConflict, "AccountNicknameViolation", "帐户昵称违规")
	AccountNotBoundRole         = Manager.New(http.StatusConflict, "AccountNotBoundRole", "帐号未绑定角色")
	AccountBoundRoleOnlyOne     = Manager.New(http.StatusConflict, "AccountBoundRoleOnlyOne", "帐号企业下只能绑定一个角色")
	AccountPhoneErr             = Manager.New(http.StatusConflict, "AccountPhoneErr", "帐号手机号错误")
	AccountPhoneNot86           = Manager.New(http.StatusConflict, "AccountPhoneNot86", "帐号手机号不是中国大陆手机号")
	AccountPhoneAlreadyRegister = Manager.New(http.StatusConflict, "AccountPhoneAlreadyRegister", "手机号已注册")
	AccountPhoneDuplicate       = Manager.New(http.StatusConflict, "AccountPhoneDuplicate", "手机号重复")
	AccountPasswordFormatErr    = Manager.New(http.StatusConflict, "AccountPasswordFormatErr", "密码格式错误")
)

// 微信用户相关
var (
	WxServiceErr            = Manager.New(http.StatusConflict, "WxServiceErr", "微信服务异常，请稍后再试")
	WxOpenIDGetErr          = Manager.New(http.StatusConflict, "WxOpenIDGetErr", "微信OpenID获取失败")
	WxUserNotExist          = Manager.New(http.StatusConflict, "WxUserNotExist", "微信用户不存在")
	WxUserPhoneAlreadyBound = Manager.New(http.StatusConflict, "WxUserPhoneAlreadyBound", "手机号已绑定其他微信用户,请先解绑")
	WxQrcodeGenerateErr     = Manager.New(http.StatusConflict, "WxQrcodeGenerateErr", "微信小程序码生成失败")
)

// 用户相关
var (
	// 无权限操作
	UserNoPermission                 = Manager.New(http.StatusConflict, "UserNoPermission", "无权限操作")
	UserBindStudentLimit             = Manager.New(http.StatusConflict, "UserBindStudentLimit", "用户绑定学生数量已达上限")
	UserBindStudentICAlreadyExists   = Manager.New(http.StatusConflict, "UserBindStudentICAlreadyExists", "学生身份证已存在")
	UserNotExists                    = Manager.New(http.StatusConflict, "UserNotExists", "用户不存在")
	UserBindStudentNameAlreadyExists = Manager.New(http.StatusConflict, "UserBindStudentNameAlreadyExists", "学生姓名已存在")
)

// 短信验证码相关
var (
	ImgCodeInvalid         = Manager.New(http.StatusConflict, "ImgCodeInvalid", "图形验证码错误")
	SmsCodeInvalid         = Manager.New(http.StatusConflict, "SmsCodeInvalid", "短信验证码错误")
	SmsSendErr             = Manager.New(http.StatusConflict, "SmsSendErr", "短信验证码发送失败")
	SmsVerificationCodeErr = Manager.New(http.StatusConflict, "SmsVerificationCodeErr", "短信验证码校验失败，请重试")
	SmsFrequencyLimit      = Manager.New(http.StatusConflict, "SmsFrequencyLimit", "短信发送过于频繁，请稍后再试")
)

// 管理后台角色相关
var (
	RoleNotExists         = Manager.New(http.StatusConflict, "RoleNotExists", "角色不存在")
	RoleHasAdminCanNotDel = Manager.New(http.StatusConflict, "RoleHasAdminCanNotDel", "角色下存在管理员无法执行删除操作")
	SuperRoleHaveExists   = Manager.New(http.StatusConflict, "SuperRoleHaveExists", "已存在超管角色")
)

// 管理后台部门相关

var (
	DeptHasAdminCanNotDel = Manager.New(http.StatusConflict, "DeptHasAdminCanNotDel", "部门下存在管理员无法执行删除操作")
	DeptHasStoreCanNotDel = Manager.New(http.StatusConflict, "DeptHasStoreCanNotDel", "部门下存在门店无法执行删除操作")
)

// 管理后台权限相关

var (
	PermissionPathDuplicate = Manager.New(http.StatusConflict, "PermissionPathDuplicate", "规则路径重复")
)

var (
	ContractSendMsgFailed = Manager.New(http.StatusConflict, "ContractSendMsgFailed", "%s")
)

// 渠道相关
var (
	ChannelNotExists      = Manager.New(http.StatusConflict, "ChannelNotExists", "渠道:%s,不存在")
	ChannelDuplicateName  = Manager.New(http.StatusConflict, "ChannelDuplicateName", "渠道名称已存在")
)

// 平台商品相关
var (
	PlatformGoodNotExists = Manager.New(http.StatusConflict, "PlatformGoodNotExists", "平台商品:%s,不存在")
)

// 商品相关
var (
	GoodNotExists               = Manager.New(http.StatusConflict, "GoodNotExists", "商品不存在")
	GoodStatusNotAllowed        = Manager.New(http.StatusConflict, "GoodStatusNotAllowed", "商品状态异常")
	GoodHasCourse               = Manager.New(http.StatusConflict, "GoodHasCourse", "商品: %s 已关联课程,无法下架")
	GoodCategoryNameDuplicate   = Manager.New(http.StatusConflict, "GoodCategoryNameDuplicate", "商品类别名称: %s 不能重复")
	GoodCategoryIdDuplicate     = Manager.New(http.StatusConflict, "GoodCategoryIdDuplicate", "商品类别Id: %s 不能重复")
	GoodCategoryCourseDuplicate = Manager.New(http.StatusConflict, "GoodCategoryCourseDuplicate", "商品类别: %s 包含课程不能重复")
	GoodCategoryCoursePutOff    = Manager.New(http.StatusConflict, "GoodCategoryCoursePutOff", "课程: %s 状态为下架时,无法关联商品")
	GoodCategoryCourseNotExists = Manager.New(http.StatusConflict, "GoodCategoryCourseNotExists", "课程: %s 不存在,无法关联商品")
	GoodChannelGoodIdDuplicate  = Manager.New(http.StatusConflict, "GoodChannelGoodIdDuplicate", "渠道商品Id: %s 已存在")
	GoodLabelTooLong            = Manager.New(http.StatusConflict, "GoodLabelTooLong", "商品标签: %s 超过4个中文字符")
)

// 课程
var (
	CourseNotExists = Manager.New(http.StatusConflict, "CourseNotExists", "课程不存在")
	CourseIsPutOff  = Manager.New(http.StatusConflict, "CourseIsPutOff", "课程已下架")
	CourseHasGood   = Manager.New(http.StatusConflict, "CourseHasGood", "课程: %s 已关联商品,无法下架")
)

// 课程库存
var (
	// 未设置库存
	CourseStockNotSet = Manager.New(http.StatusConflict, "CourseStockNotSet", "课程:%s,未设置库存")
	// 课程库存已设置
	CourseStockDatePeriodDuplicate = Manager.New(http.StatusConflict, "CourseStockDatePeriodDuplicate", "课程:%s,日期:%s,时间段:%s重复")
	// 已设置课程时间
	CourseStockPeriodHasSet = Manager.New(http.StatusConflict, "CourseStockPeriodHasSet", "课程:%s,已设置课程日期:%s,时间:%s")
	// 课程状态相同
	CourseStatusSame = Manager.New(http.StatusConflict, "CourseStatusSame", "课程:%s,状态相同,无需修改")
	// 课程库存已存在预约
	CourseStockHasAppointment = Manager.New(http.StatusConflict, "CourseStockHasAppointment", "日期:%s,时间段:%s,已存在预约,无法下架")
	// 课程库存不能小于预约人数
	CourseStockLessThanAppointment = Manager.New(http.StatusConflict, "CourseStockLessThanAppointment", "库存不能小于已预约人数:%s")
)

// 课程预约
var (
	CourseAppointmentStatusNotAllowed             = Manager.New(http.StatusConflict, "CourseAppointmentStatusNotAllowed", "课程预约状态不允许")
	CourseAppointmentNotAllowedForOrderStatus     = Manager.New(http.StatusConflict, "CourseAppointmentNotAllowedForOrderStatus", "订单状态不允许预约课程")
	CourseAppointmentNotAllowedForGoodStatus      = Manager.New(http.StatusConflict, "CourseAppointmentNotAllowedForGoodStatus", "商品状态不允许预约课程")
	CourseAppointmentNotAllowedForStock           = Manager.New(http.StatusConflict, "CourseAppointmentNotAllowedForStock", "课程预约次数已用完")
	CourseAppointmentNotAllowedForRepeat          = Manager.New(http.StatusConflict, "CourseAppointmentNotAllowedForRepeat", "课程不能重复预约")
	CourseAppointmentNotAllowedForCourseNotExists = Manager.New(http.StatusConflict, "CourseAppointmentNotAllowedForCourseNotExists", "课程不存在")
	CourseAppointmentNotAllowedForStockNotEnough  = Manager.New(http.StatusConflict, "CourseAppointmentNotAllowedForStockNotEnough", "课程库存不足")
	CourseAppointmentCreateTimeNotAllowed         = Manager.New(http.StatusConflict, "CourseAppointmentCreateTimeNotAllowed", "您好，该课程目前暂不支持预约，请您确认好时间安排。如有其他问题，欢迎随时联系我们！")
	CourseAppointmentCancelTimeNotAllowed         = Manager.New(http.StatusConflict, "CourseAppointmentCancelTimeNotAllowed", "您好，该课程目前暂不支持调整或取消预约，请您确认好时间安排。如有其他问题，欢迎随时联系我们！")
	CourseAppointmentUpdateTimeNotAllowed         = Manager.New(http.StatusConflict, "CourseAppointmentUpdateTimeNotAllowed", "您好，该课程目前暂不支持调整或取消预约，请您确认好时间安排。如有其他问题，欢迎随时联系我们！")
)

// 订单相关
var (
	OrderNotExists             = Manager.New(http.StatusConflict, "OrderNotExists", "订单不存在")
	OrderStatusNotAllowed      = Manager.New(http.StatusConflict, "OrderStatusNotAllowed", "订单状态不被允许")
	OrderChangePhoneNotAllowed = Manager.New(http.StatusConflict, "OrderChangePhoneNotAllowed", "只有待预约和已预约状态允许修改手机号")
)

var (
	GoodRecommendationCategoryNotFound = Manager.New(http.StatusConflict, "GoodRecommendationCategoryNotFound", "商品推荐分类不存在")
)

var (
	ContractTemplateNameDuplicateError = Manager.New(http.StatusConflict, "ContractTemplateNameDuplicateError", "模板名称已存在，请使用其他名称")
)
