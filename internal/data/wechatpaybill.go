package data

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v2/log"

	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
)

var _ biz.WechatPayBillRepo = (*WechatPayBillRepo)(nil)

func NewWechatPayBillRepo(
	logger log.Logger,
	data *Data,
	wechatPayBillRepo *yanxue_repo.WechatPayBillRepo,
) biz.WechatPayBillRepo {
	l := log.NewHelper(log.With(logger, "module", "data/wechatPayBillRepo"), log.WithMessageKey("message"))
	return &WechatPayBillRepo{
		log:               l,
		data:              data,
		WechatPayBillRepo: wechatPayBillRepo,
	}
}

type WechatPayBillRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.WechatPayBillRepo
}

// FindListByTradeTimeRange 根据交易时间范围查询账单列表（分批查询）
func (r *WechatPayBillRepo) FindListByTradeTimeRange(ctx context.Context, startTime, endTime time.Time) ([]*yanxue_model.WechatPayBill, error) {
	dao := yanxue_dao.Use(r.data.db).WechatPayBill

	const batchSize = 1000 // 每批查询1000条
	var allBills []*yanxue_model.WechatPayBill
	offset := 0

	for {
		// 分批查询
		bills, err := dao.WithContext(ctx).Where(
			dao.TradeTime.Gte(startTime),
			dao.TradeTime.Lte(endTime),
		).Order(dao.TradeTime.Desc()).
			Offset(offset).
			Limit(batchSize).
			Find()

		if err != nil {
			return nil, err
		}

		// 没有更多数据了
		if len(bills) == 0 {
			break
		}

		allBills = append(allBills, bills...)
		r.log.Infof("已查询账单数据：%d 条", len(allBills))

		// 如果本批次数据少于批次大小，说明已经是最后一批
		if len(bills) < batchSize {
			break
		}

		offset += batchSize
	}

	r.log.Infof("查询完成，共 %d 条账单数据", len(allBills))
	return allBills, nil
}
