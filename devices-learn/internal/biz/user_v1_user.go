package biz

import "github.com/go-kratos/kratos/v2/log"

func NewUserV1UserUseCase(
	logger log.Logger,
) *UserV1UserUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/userV1User"), log.WithMessageKey("message"))
	return &UserV1UserUseCase{
		log: l,
	}
}

type UserV1UserUseCase struct {
	log *log.Helper
}
