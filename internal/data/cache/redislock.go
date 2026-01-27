package cache

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/cache/redislock"
)

type RedisLock struct {
	rd  *redis.Client
	ttl time.Duration
}

type Option func(gen *RedisLock)

// WithTTL 选项函数-设置过期时间
func WithTTL(t time.Duration) Option {
	return func(r *RedisLock) {
		r.ttl = t
	}
}

func NewRedisLock(rd *redis.Client, opts ...Option) *RedisLock {
	r := &RedisLock{
		rd:  rd,
		ttl: time.Minute * 10, // 默认10分钟
	}
	if len(opts) > 0 {
		for _, v := range opts {
			v(r)
		}
	}
	return r
}

func (p *RedisLock) AutoLock(ctx context.Context, key string, fn func() error) error {
	locker, err := redislock.Obtain(ctx, p.rd, key, p.ttl, nil)
	if err != nil {
		return errorx.RequestFrequentErr.WithError(err).Err()
	}
	defer func(locker *redislock.Lock, ctx context.Context) {
		_ = locker.Release(ctx)
	}(locker, ctx)
	return fn()
}

func (p *RedisLock) AutoLockRetry(ctx context.Context, key string, fn func() error) error {
	locker, err := redislock.Obtain(ctx, p.rd, key, p.ttl, &redislock.Options{
		RetryStrategy: redislock.LimitRetry(redislock.LinearBackoff(200*time.Millisecond), 5),
	})
	if err != nil {
		return errorx.RequestFrequentErr.WithError(err).Err()
	}
	defer func(locker *redislock.Lock, ctx context.Context) {
		_ = locker.Release(ctx)
	}(locker, ctx)
	return fn()
}

func (p *RedisLock) LockOnce(ctx context.Context, key string, fn func() error) error {
	_, err := redislock.Obtain(ctx, p.rd, key, p.ttl, nil)
	if err != nil {
		return errorx.RequestFrequentErr.WithError(err).Err()
	}
	return fn()
}
