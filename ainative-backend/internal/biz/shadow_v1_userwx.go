package biz

import (
	"github.com/FrancisLv/PowerWeChat/v3/src/officialAccount"
	"github.com/go-kratos/kratos/v2/log"
)

func NewShadowV1UserWxUseCase(
	logger log.Logger,
	userWxRepo UserWxRepo,
	officialAccount *officialAccount.OfficialAccount,
) *ShadowV1UserWxUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1UserWx"), log.WithMessageKey("message"))
	return &ShadowV1UserWxUseCase{
		log:             l,
		userWxRepo:      userWxRepo,
		officialAccount: officialAccount,
	}
}

type ShadowV1UserWxUseCase struct {
	log             *log.Helper
	userWxRepo      UserWxRepo
	officialAccount *officialAccount.OfficialAccount
}
