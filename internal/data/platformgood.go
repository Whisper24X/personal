package data

import (
	"context"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.PlatformGoodRepo = (*PlatformGoodRepo)(nil)

func NewPlatformGoodRepo(
	logger log.Logger,
	data *Data,
	platformGoodRepo *yanxue_repo.PlatformGoodRepo,
) biz.PlatformGoodRepo {
	l := log.NewHelper(log.With(logger, "module", "data/platformGood"), log.WithMessageKey("message"))
	return &PlatformGoodRepo{
		log:              l,
		data:             data,
		PlatformGoodRepo: platformGoodRepo,
	}
}

type PlatformGoodRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.PlatformGoodRepo
}

func (r *PlatformGoodRepo) PlatformGoodIdToGoodType(ctx context.Context, goodIds []string) (map[string]string, error) {
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
		goodMap[good.ID] = good.GoodType
	}
	return goodMap, nil
}
