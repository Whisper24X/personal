package data

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gorm.io/gorm/clause"
)

var _ biz.GoodRepo = (*GoodRepo)(nil)

func NewGoodRepo(
	logger log.Logger,
	data *Data,
	goodRepo *yanxue_repo.GoodRepo,
) biz.GoodRepo {
	l := log.NewHelper(log.With(logger, "module", "data/good"), log.WithMessageKey("message"))
	return &GoodRepo{
		log:      l,
		data:     data,
		GoodRepo: goodRepo,
	}
}

type GoodRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.GoodRepo
}

func (r *GoodRepo) GoodIdToName(ctx context.Context, goodIds []string) (map[string]string, error) {
	goodIds = lo.Uniq(goodIds)
	goodIds = lo.Filter(goodIds, func(item string, _ int) bool {
		return item != ""
	})
	if len(goodIds) == 0 {
		return map[string]string{}, nil
	}
	goodMap := make(map[string]string)
	good, err := r.FindMultiCacheByIDS(ctx, goodIds)
	if err != nil {
		return nil, err
	}
	for _, good := range good {
		goodMap[good.ID] = good.Name
	}
	return goodMap, nil
}

// 查询已上架的商品中存在指定的课程ID的商品ID
func (r *GoodRepo) HasCourseGoodIds(ctx context.Context, courseId string) ([]string, error) {
	goodList, _, err := r.FindMultiCacheByCondition(ctx, &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "status",
				Value: constant.GoodStatusPutOn.String(),
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "content",
				Value: clause.Expr{
					SQL:                "content->'goodCategories' @> ?::jsonb",
					Vars:               []interface{}{`[{"courses":[{"courseId":"` + courseId + `"}]}]`},
					WithoutParentheses: false,
				},
				Exp:   condition.RAW,
				Logic: condition.AND,
			},
		},
	})
	if err != nil {
		return nil, err
	}
	goodIds := make([]string, 0)
	for _, good := range goodList {
		goodIds = append(goodIds, good.ID)
	}
	return lo.Uniq(goodIds), nil
}

// PreDeductStock 预扣库存（使用乐观锁，返回是否成功）
// 使用乐观锁机制：UPDATE good SET stock = stock - num WHERE id = goodId AND (stock IS NULL OR stock >= num)
// 返回 true 表示预扣成功，false 表示库存不足
func (r *GoodRepo) PreDeductStock(ctx context.Context, goodId string, num int32) (bool, error) {
	if num <= 0 {
		return false, nil
	}
	// 使用原生 SQL 实现乐观锁
	// 注意：stock IS NULL 表示无限库存，不需要扣减
	// stock >= num 表示库存充足，可以扣减
	result := r.data.db.WithContext(ctx).Exec(
		"UPDATE good SET stock = stock - ? WHERE id = ? AND (stock IS NULL OR stock >= ?)",
		num, goodId, num,
	)
	if result.Error != nil {
		return false, result.Error
	}
	// 检查是否有行被更新
	return result.RowsAffected > 0, nil
}

// RollbackStock 回补库存
func (r *GoodRepo) RollbackStock(ctx context.Context, goodId string, num int32) error {
	if num <= 0 {
		return nil
	}
	// 回补库存：只对有限库存的商品回补（stock IS NOT NULL）
	result := r.data.db.WithContext(ctx).Exec(
		"UPDATE good SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL",
		num, goodId,
	)
	return result.Error
}
