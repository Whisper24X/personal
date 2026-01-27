package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1UserUseCase(
	logger log.Logger,
	userRepo UserRepo,
	userWxRepo UserWxRepo,
) *ShadowV1UserUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1User"), log.WithMessageKey("message"))
	return &ShadowV1UserUseCase{
		log:        l,
		userRepo:   userRepo,
		userWxRepo: userWxRepo,
	}
}

type ShadowV1UserUseCase struct {
	log        *log.Helper
	userRepo   UserRepo
	userWxRepo UserWxRepo
}
