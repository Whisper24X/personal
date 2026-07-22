package biz

import "github.com/go-kratos/kratos/v2/log"

func NewDesktopV1DesktopUseCase(
	logger log.Logger,
) *DesktopV1DesktopUseCase {
	l := log.NewHelper(log.With(logger, "module", "biz/desktopV1Desktop"), log.WithMessageKey("message"))
	return &DesktopV1DesktopUseCase{
		log: l,
	}
}

type DesktopV1DesktopUseCase struct {
	log *log.Helper
}
