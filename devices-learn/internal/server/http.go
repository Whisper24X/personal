package server

import (
	netHttp "net/http"

	"github.com/go-kratos/kratos/v2/middleware/metadata"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/transport/http"
	courselearnv1 "gitlab.yc345.tv/backend/devices-learn/api/course_learn/v1"
	desktopv1 "gitlab.yc345.tv/backend/devices-learn/api/desktop/v1"
	diagnosisv1 "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
	dynamicdockconfigv1 "gitlab.yc345.tv/backend/devices-learn/api/dynamic_dock_config/v1"
	dynamicfunctionconfigv1 "gitlab.yc345.tv/backend/devices-learn/api/dynamic_function_config/v1"
	dynamiclearnconfigv1 "gitlab.yc345.tv/backend/devices-learn/api/dynamic_learn_config/v1"
	homeworkassistantv1 "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
	learnconfigv1 "gitlab.yc345.tv/backend/devices-learn/api/learn_config/v1"
	npsv1 "gitlab.yc345.tv/backend/devices-learn/api/nps/v1"
	stylev1 "gitlab.yc345.tv/backend/devices-learn/api/style/v1"
	targetv1 "gitlab.yc345.tv/backend/devices-learn/api/target/v1"
	taskv1 "gitlab.yc345.tv/backend/devices-learn/api/task/v1"
	userv1 "gitlab.yc345.tv/backend/devices-learn/api/user/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/conf"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/errorx"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/errx"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/middleware/logger"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/middleware/recovery"
	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/middleware/validate"
	"gitlab.yc345.tv/backend/devices-learn/internal/service"
	"gitlab.yc345.tv/backend/utils/v2/health/core"
	krs "gitlab.yc345.tv/backend/utils/v2/health/kratos"
	"gitlab.yc345.tv/backend/utils/v2/metrics"
	requestCancel "gitlab.yc345.tv/backend/utils/v2/requestCancelHandle/middleware"
)

// NewHTTPServer new a HTTP server.
func NewHTTPServer(
	config *conf.Bootstrap,
	courseLearn *service.CourseLearnV1CourseLearnService,
	desktop *service.DesktopV1DesktopService,
	diagnosis *service.DiagnosisV1DiagnosisService,
	dynamicDockConfig *service.DynamicDockConfigV1DynamicDockConfigService,
	dynamicFunctionConfig *service.DynamicFunctionConfigV1DynamicFunctionConfigService,
	dynamicLearnConfig *service.DynamicLearnConfigV1DynamicLearnConfigService,
	homeworkAssistant *service.HomeworkAssistantV1HomeworkAssistantService,
	learnConfig *service.LearnConfigV1LearnConfigService,
	nps *service.NpsV1NpsService,
	style *service.StyleV1StyleService,
	target *service.TargetV1TargetService,
	task *service.TaskV1TaskService,
	user *service.UserV1UserService,
) *http.Server {
	var opts = []http.ServerOption{
		// tracing,logger, recovery的顺序不能变
		http.Middleware(
			tracing.Server(),
			metrics.KratosMiddleware(),
			logger.HTTPLogger(config),
			recovery.Recovery(),
			metadata.Server(),
			validate.Validator(),
			ratelimit.Server(),
			requestCancel.KratosMiddleware(&requestCancel.Option{
				Timeout: config.GetServer().GetHttp().GetTimeout().AsDuration(),
			}),
		),
		krs.ServerOption(core.Manager),
	}
	if config.Server.Http.Network != "" {
		opts = append(opts, http.Network(config.Server.Http.Network))
	}
	if config.Server.Http.Addr != "" {
		opts = append(opts, http.Address(config.Server.Http.Addr))
	}
	if config.Server.Http.Timeout != nil {
		opts = append(opts, http.Timeout(config.Server.Http.Timeout.AsDuration()))
	}
	opts = append(opts, http.ErrorEncoder(errx.HTTPErrorEncoder(errorx.Manager)), http.ResponseEncoder(ResponseEncoder))
	srv := http.NewServer(opts...)

	courselearnv1.RegisterCourseLearnHTTPServer(srv, courseLearn)
	desktopv1.RegisterDesktopHTTPServer(srv, desktop)
	diagnosisv1.RegisterDiagnosisHTTPServer(srv, diagnosis)
	dynamicdockconfigv1.RegisterDynamicDockConfigHTTPServer(srv, dynamicDockConfig)
	dynamicfunctionconfigv1.RegisterDynamicFunctionConfigHTTPServer(srv, dynamicFunctionConfig)
	dynamiclearnconfigv1.RegisterDynamicLearnConfigHTTPServer(srv, dynamicLearnConfig)
	homeworkassistantv1.RegisterHomeworkAssistantHTTPServer(srv, homeworkAssistant)
	learnconfigv1.RegisterLearnConfigHTTPServer(srv, learnConfig)
	npsv1.RegisterNpsHTTPServer(srv, nps)
	stylev1.RegisterStyleHTTPServer(srv, style)
	targetv1.RegisterTargetHTTPServer(srv, target)
	taskv1.RegisterTaskHTTPServer(srv, task)
	userv1.RegisterUserHTTPServer(srv, user)

	return srv
}

// ResponseEncoder encodes the object to the HTTP response.
func ResponseEncoder(w http.ResponseWriter, r *http.Request, v interface{}) error {
	if v == nil {
		return nil
	}
	if rd, ok := v.(http.Redirector); ok {
		url, code := rd.Redirect()
		netHttp.Redirect(w, r, url, code)
		return nil
	}
	codec, _ := http.CodecForRequest(r, "Accept")
	data, err := codec.Marshal(v)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/"+codec.Name())
	w.Header().Set("X-Trace-Id", r.Header.Get("TraceID"))
	_, err = w.Write(data)
	if err != nil {
		return err
	}
	return nil
}
