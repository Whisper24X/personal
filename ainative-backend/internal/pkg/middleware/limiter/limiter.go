package limiter

import (
	"time"

	"github.com/go-kratos/aegis/ratelimit/bbr"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/spf13/cast"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
)

// Limit 限流
func Limit(config *conf.Bootstrap) middleware.Middleware {
	bbrOption := []bbr.Option{
		bbr.WithWindow(time.Second * cast.ToDuration(config.Ratelimit.Window)),
		bbr.WithBucket(cast.ToInt(config.Ratelimit.Bucket)),
		bbr.WithCPUThreshold(config.Ratelimit.CpuThreshold),
	}
	limitOption := ratelimit.WithLimiter(bbr.NewLimiter(bbrOption...))
	return ratelimit.Server(limitOption)
}
