package biz

import (
	"github.com/go-kratos/kratos/v2/log"
)

func NewShadowV1UserCouponUseCase(
	logger log.Logger,
	userCouponRepo UserCouponRepo,
	commonRepo CommonRepo,
) *ShadowV1UserCouponUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/shadowV1UserCoupon"), log.WithMessageKey("message"))
	return &ShadowV1UserCouponUseCase{
		log:            l,
		userCouponRepo: userCouponRepo,
		commonRepo:     commonRepo,
	}
}

type ShadowV1UserCouponUseCase struct {
	log            *log.Helper
	userCouponRepo UserCouponRepo
	commonRepo     CommonRepo
}
