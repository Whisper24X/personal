package auth

import (
	"context"
	"strings"

	"github.com/go-kratos/kratos/v2/middleware/selector"
	"github.com/samber/lo"
)

// whiteListMatcher 路由白名单匹配器  true 校验 false 不校验
func whiteListMatcher(whiteList map[string][]string) selector.MatchFunc {
	return func(ctx context.Context, operation string) bool {
		for k, v := range whiteList {
			if strings.HasPrefix(operation, k) {
				return !lo.Contains(v, operation)
			}
		}
		return false
	}
}
