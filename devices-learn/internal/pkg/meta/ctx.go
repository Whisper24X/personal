package meta

import (
	"context"

	"github.com/go-kratos/kratos/v2/transport"
)

func GetSNIdFromHeader(ctx context.Context) string {
	if tr, ok := transport.FromServerContext(ctx); ok {
		return tr.RequestHeader().Get("SNId")
	}
	return ""
}
