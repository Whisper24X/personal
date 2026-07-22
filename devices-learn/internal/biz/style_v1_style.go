package biz

import "github.com/go-kratos/kratos/v2/log"

func NewStyleV1StyleUseCase(
	logger log.Logger,
) *StyleV1StyleUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/styleV1Style"), log.WithMessageKey("message"))
	return &StyleV1StyleUseCase{
		log: l,
	}
}

type StyleV1StyleUseCase struct {
	log *log.Helper
}
