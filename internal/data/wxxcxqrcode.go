package data

import (
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.WxXcxQrcodeRepo = (*WxXcxQrcodeRepo)(nil)

func NewWxXcxQrcodeRepo(
	logger log.Logger,
	data *Data,
	wxXcxQrcodeRepo *yanxue_repo.WxXcxQrcodeRepo,
) biz.WxXcxQrcodeRepo {
	l := log.NewHelper(log.With(logger, "module", "data/wxXcxQrcode"), log.WithMessageKey("message"))
	return &WxXcxQrcodeRepo{
		log:             l,
		data:            data,
		WxXcxQrcodeRepo: wxXcxQrcodeRepo,
	}
}

type WxXcxQrcodeRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.WxXcxQrcodeRepo
}
