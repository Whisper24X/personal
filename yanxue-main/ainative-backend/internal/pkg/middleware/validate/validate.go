package validate

import (
	"context"

	"github.com/go-kratos/kratos/v2/middleware"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

type validator interface {
	Validate() error
}

// Validator is a validator middleware. 定制化替换官方的
func Validator() middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
			if v, ok := req.(validator); ok {
				if err := v.Validate(); err != nil {
					return nil, errorx.ParamErr.WithError(err).Err()
				}
			}
			return handler(ctx, req)
		}
	}
}
