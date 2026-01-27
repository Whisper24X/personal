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
