package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
)

func NewWechatV1GoodService(
	logger log.Logger,
	wechatV1GoodUseCase *biz.WechatV1GoodUseCase,
) *WechatV1GoodService {
	l := log.NewHelper(log.With(logger, "module", "service/wechatV1Good"), log.WithMessageKey("message"))
	return &WechatV1GoodService{
		log:                 l,
		wechatV1GoodUseCase: wechatV1GoodUseCase,
	}
}

type WechatV1GoodService struct {
	pb.UnimplementedGoodServer
	log                 *log.Helper
	wechatV1GoodUseCase *biz.WechatV1GoodUseCase
}

// GetGoodInfo 渠道商品表-单条数据查询
func (w *WechatV1GoodService) GetGoodInfo(ctx context.Context, req *pb.GetGoodInfoReq) (*pb.GetGoodInfoReply, error) {
	return w.wechatV1GoodUseCase.GetGoodInfo(ctx, req)
}
