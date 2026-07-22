package data

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
	"gitlab.yc345.tv/backend/devices-learn/internal/conf"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/cache"
	"gitlab.yc345.tv/backend/devices-learn/internal/data/gorm/devices_learn_dao"
)

var _ biz.CommonRepo = (*CommonRepo)(nil)

func NewCommonRepo(
	logger log.Logger,
	cfg *conf.Bootstrap,
	data *Data,
) biz.CommonRepo {
	l := log.NewHelper(log.With(logger, "module", "data/common"), log.WithMessageKey("message"))
	return &CommonRepo{
		log:  l,
		cfg:  cfg,
		data: data,
	}
}

type CommonRepo struct {
	log  *log.Helper
	cfg  *conf.Bootstrap
	data *Data
}

// AutoLock 自动锁
func (a *CommonRepo) AutoLock(ctx context.Context, key string, ttl time.Duration, fn func() error) error {
	return cache.NewRedisLock(a.data.goRedisClient, cache.WithTTL(ttl)).AutoLock(ctx, key, fn)
}

// AutoLockRetry 自动锁重试
func (a *CommonRepo) AutoLockRetry(ctx context.Context, key string, ttl time.Duration, fn func() error) error {
	return cache.NewRedisLock(a.data.goRedisClient, cache.WithTTL(ttl)).AutoLockRetry(ctx, key, fn)
}

// LockOnce 锁一次
func (a *CommonRepo) LockOnce(ctx context.Context, key string, ttl time.Duration, fn func() error) error {
	return cache.NewRedisLock(a.data.goRedisClient, cache.WithTTL(ttl)).LockOnce(ctx, key, fn)
}

// Transaction 事务处理
func (a *CommonRepo) Transaction(ctx context.Context, fn func(tx *devices_learn_dao.Query) error) error {
	err := devices_learn_dao.Use(a.data.db).Transaction(fn)
	if err != nil {
		return err
	}
	return nil
}

// ClearCache 清除缓存
func (a *CommonRepo) ClearCache(ctx context.Context) error {
	return a.data.goRedisClient.FlushDBAsync(ctx).Err()
}
