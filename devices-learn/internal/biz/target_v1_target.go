package biz

import "github.com/go-kratos/kratos/v2/log"

func NewTargetV1TargetUseCase(
	logger log.Logger,
) *TargetV1TargetUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/targetV1Target"), log.WithMessageKey("message"))
	return &TargetV1TargetUseCase{
		log: l,
	}
}

type TargetV1TargetUseCase struct {
	log *log.Helper
}
