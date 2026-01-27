package data

import (
	"context"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"

	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.UserCouponRepo = (*UserCouponRepo)(nil)

func NewUserCouponRepo(
	logger log.Logger,
	data *Data,
	userCouponRepo *yanxue_repo.UserCouponRepo,
) biz.UserCouponRepo {
	l := log.NewHelper(log.With(logger, "module", "data/userCoupon"), log.WithMessageKey("message"))
	return &UserCouponRepo{
		log:            l,
		data:           data,
		UserCouponRepo: userCouponRepo,
	}
}

type UserCouponRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.UserCouponRepo
}

// CountByCouponID 根据couponID统计数量
func (u *UserCouponRepo) CountByCouponID(ctx context.Context, couponIDs []string, status string) (map[string]int64, error) {
	result := make(map[string]int64)

	if len(couponIDs) == 0 {
		return result, nil
	}

	dao := yanxue_dao.Use(u.data.db).UserCoupon
	db := dao.WithContext(ctx)

	// 如果指定了状态，则添加状态条件
	if status != "" {
		db = db.Where(dao.Status.Eq(status))
	}

	// 使用 GROUP BY 和 COUNT 统计每个 couponID 的数量
	var counts []struct {
		CouponID string `gorm:"column:couponId"`
		Count    int64  `gorm:"column:count"`
	}

	// 执行查询
	err := db.Select(dao.CouponID, dao.ID.Count().As("count")).Where(dao.CouponID.In(couponIDs...)).Group(dao.CouponID).Scan(&counts)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 将结果转换为 map
	for _, count := range counts {
		result[count.CouponID] = count.Count
	}

	// 对于没有找到记录的 couponID，设置数量为 0
	for _, couponID := range couponIDs {
		if _, exists := result[couponID]; !exists {
			result[couponID] = 0
		}
	}

	return result, nil
}
