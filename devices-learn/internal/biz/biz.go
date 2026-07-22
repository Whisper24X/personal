package biz

import (
	"context"
	"time"

	"github.com/google/wire"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_dao"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_repo"
)

// ProviderSet is biz providers.
var ProviderSet = wire.NewSet(
	NewCourseLearnV1CourseLearnUseCase,
	NewDesktopV1DesktopUseCase,
	NewDiagnosisV1DiagnosisUseCase,
	NewDynamicDockConfigV1DynamicDockConfigUseCase,
	NewDynamicFunctionConfigV1DynamicFunctionConfigUseCase,
	NewDynamicLearnConfigV1DynamicLearnConfigUseCase,
	NewHomeworkAssistantV1HomeworkAssistantUseCase,
	NewLearnConfigV1LearnConfigUseCase,
	NewNpsV1NpsUseCase,
	NewStyleV1StyleUseCase,
	NewTargetV1TargetUseCase,
	NewTaskV1TaskUseCase,
	NewUserV1UserUseCase,
)

type CommonRepo interface {
	AutoLock(ctx context.Context, key string, ttl time.Duration, fn func() error) error
	AutoLockRetry(ctx context.Context, key string, ttl time.Duration, fn func() error) error
	LockOnce(ctx context.Context, key string, ttl time.Duration, fn func() error) error
	Transaction(ctx context.Context, fn func(tx *devices_learn_dao.Query) error) error
	ClearCache(ctx context.Context) error
}

type LearnConfigRepo interface {
	devices_learn_repo.ILearnConfigRepo
}

type NpsSummaryRepo interface {
	devices_learn_repo.INpsSummaryRepo
}

type DynamicFunctionConfigRepo interface {
	devices_learn_repo.IDynamicFunctionConfigRepo
}

type HomeworkAssistantUserStudyStatisticRepo interface {
	devices_learn_repo.IHomeworkAssistantUserStudyStatisticRepo
}

type NpsGoLearnSceneNumRepo interface {
	devices_learn_repo.INpsGoLearnSceneNumRepo
}

type DynamicDockConfigV2Repo interface {
	devices_learn_repo.IDynamicDockConfigV2Repo
}

type HomeworkAssistantScoreRepo interface {
	devices_learn_repo.IHomeworkAssistantScoreRepo
}

type DynamicDockConfigRepo interface {
	devices_learn_repo.IDynamicDockConfigRepo
}

type NpRepo interface {
	devices_learn_repo.INpRepo
}

type HomeworkAssistantRecordRepo interface {
	devices_learn_repo.IHomeworkAssistantRecordRepo
}

type HomeworkAssistantRectificationRecordRepo interface {
	devices_learn_repo.IHomeworkAssistantRectificationRecordRepo
}

type UserLearnStyleRepo interface {
	devices_learn_repo.IUserLearnStyleRepo
}

type DynamicLearnConfigRepo interface {
	devices_learn_repo.IDynamicLearnConfigRepo
}

type HomeworkAssistantCorrectionRecordRepo interface {
	devices_learn_repo.IHomeworkAssistantCorrectionRecordRepo
}

type UserLearnTargetRepo interface {
	devices_learn_repo.IUserLearnTargetRepo
}
