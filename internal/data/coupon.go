package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.CouponRepo = (*CouponRepo)(nil)

func NewCouponRepo(
	logger log.Logger,
	data *Data,
	couponRepo *yanxue_repo.CouponRepo,
) biz.CouponRepo {
	l := log.NewHelper(log.With(logger, "module", "data/coupon"), log.WithMessageKey("message"))
	return &CouponRepo{
		log:        l,
		data:       data,
		CouponRepo: couponRepo,
	}
}

type CouponRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.CouponRepo
}
