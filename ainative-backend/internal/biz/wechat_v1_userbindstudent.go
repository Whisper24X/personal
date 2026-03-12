package biz

import (
	"github.com/go-kratos/kratos/v2/log"
)

func NewWechatV1UserBindStudentUseCase(
	logger log.Logger,
	userBindStudentRepo UserBindStudentRepo,
) *WechatV1UserBindStudentUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/wechatV1UserBindStudent"), log.WithMessageKey("message"))
	return &WechatV1UserBindStudentUseCase{
		log:                 l,
		userBindStudentRepo: userBindStudentRepo,
	}
}

type WechatV1UserBindStudentUseCase struct {
	log                 *log.Helper
	userBindStudentRepo UserBindStudentRepo
}
