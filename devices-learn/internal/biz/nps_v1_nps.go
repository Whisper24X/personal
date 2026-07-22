package biz

import "github.com/go-kratos/kratos/v2/log"

func NewNpsV1NpsUseCase(
	logger log.Logger,
) *NpsV1NpsUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/npsV1Nps"), log.WithMessageKey("message"))
	return &NpsV1NpsUseCase{
		log: l,
	}
}

type NpsV1NpsUseCase struct {
	log *log.Helper
}
