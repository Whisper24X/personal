package errorx

import (
	"net/http"

	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/errx"
)

var Manager = errx.NewErrorManager(errx.WithI18n(errx.EnUS, EnUSMap))

var (
	InternalServerError = Manager.New(http.StatusInternalServerError, "InternalServerError", "服务崩溃了,请稍后再试")
)

// 参数相关
var (
	ParamBindErr        = Manager.New(http.StatusBadRequest, "ParamBindErr", "参数绑定错误")
	ParamErr            = Manager.New(http.StatusBadRequest, "ParamErr", "参数错误")
	ParamValidationErr  = Manager.New(http.StatusBadRequest, "ParamValidationErr", "参数验证错误")
	ParamNotJSONRequest = Manager.New(http.StatusBadRequest, "ParamNotJSONRequest", "参数不是JSON请求")
	ParamHeaderErr      = Manager.New(http.StatusBadRequest, "ParamHeaderErr", "参数Header错误")
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
)

// 请求相关
var (
	RequestCanceledErr = Manager.New(http.StatusConflict, "RequestCanceledErr", "请求取消")
	RequestTimeoutErr  = Manager.New(http.StatusGatewayTimeout, "RequestTimeoutErr", "请求超时")
	RequestFrequentErr = Manager.New(http.StatusConflict, "RequestFrequent", "请求频繁,请稍后再试!!!")
	APIInternalErr     = Manager.New(http.StatusConflict, "APIInternalErr", "请求错误(I),请稍后再试")
	APIThirdErr        = Manager.New(http.StatusConflict, "APIThirdErr", "请求错误(T),请稍后再试")
)

// 组织相关

var (
	IIUGLevelError = Manager.New(http.StatusConflict, "IIUGLevelError", "组织类型错误")
)

// 设备相关

var (
	DeviceSNidNotExist = Manager.New(http.StatusConflict, "DeviceSNidNotExist", "设备ID不存在")
	DeviceDoesNotExist = Manager.New(http.StatusConflict, "DeviceDoesNotExist", "设备不存在")
)
