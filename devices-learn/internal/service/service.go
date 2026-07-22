package service

import (
	"github.com/google/wire"
)

// ProviderSet is service providers.
var ProviderSet = wire.NewSet(
	NewCourseLearnV1CourseLearnService,
	NewDesktopV1DesktopService,
	NewDevicesLearnV1AsyncService,
	NewDiagnosisV1DiagnosisService,
	NewDynamicDockConfigV1DynamicDockConfigService,
	NewDynamicFunctionConfigV1DynamicFunctionConfigService,
	NewDynamicLearnConfigV1DynamicLearnConfigService,
	NewHomeworkAssistantV1HomeworkAssistantService,
	NewLearnConfigV1LearnConfigService,
	NewNpsV1NpsService,
	NewStyleV1StyleService,
	NewTargetV1TargetService,
	NewTaskV1TaskService,
	NewUserV1UserService,
)
