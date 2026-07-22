package biz

import "github.com/go-kratos/kratos/v2/log"

func NewLearnConfigV1LearnConfigUseCase(
	logger log.Logger,
) *LearnConfigV1LearnConfigUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/learnConfigV1LearnConfig"), log.WithMessageKey("message"))
	return &LearnConfigV1LearnConfigUseCase{
		log: l,
	}
}

type LearnConfigV1LearnConfigUseCase struct {
	log *log.Helper
}
