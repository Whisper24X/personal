package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1UserBindStudentUseCase(
	logger log.Logger,
	userBindStudentRepo UserBindStudentRepo,
	userRepo UserRepo,
) *ShadowV1UserBindStudentUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1UserBindStudent"), log.WithMessageKey("message"))
	return &ShadowV1UserBindStudentUseCase{
		log:                 l,
		userBindStudentRepo: userBindStudentRepo,
		userRepo:            userRepo,
	}
}

type ShadowV1UserBindStudentUseCase struct {
	log                 *log.Helper
	userBindStudentRepo UserBindStudentRepo
	userRepo            UserRepo
}
