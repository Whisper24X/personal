package cache

import (
	"time"

	"gitlab.yc345.tv/backend/devices-learn/internal/pkg/cache/keymanage"
)

var cacheKey = keymanage.New("devices-learn")

var (
	LOCK       = cacheKey.AddKey("LOCK", time.Minute*5, "锁")
	RouteCache = cacheKey.AddKey("RouteCache", time.Hour*24, "路由缓存")
)
