package data

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	shadowV1 "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

var _ biz.DynamicFieldMappingRepo = (*DynamicFieldMappingRepo)(nil)

func NewDynamicFieldMappingRepo(
	logger log.Logger,
	data *Data,
	dynamicFieldMappingRepo *yanxue_repo.DynamicFieldMappingRepo,
) biz.DynamicFieldMappingRepo {
	l := log.NewHelper(log.With(logger, "module", "data/dynamicFieldMapping"), log.WithMessageKey("message"))
	return &DynamicFieldMappingRepo{
		log:                     l,
		data:                    data,
		DynamicFieldMappingRepo: dynamicFieldMappingRepo,
	}
}

type DynamicFieldMappingRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.DynamicFieldMappingRepo
}

func (d *DynamicFieldMappingRepo) DTOShadowDynamicFieldMapping(item *yanxue_model.DynamicFieldMapping) (*shadowV1.DynamicFieldMappingInfo, error) {
	mappingInfo := &shadowV1.DynamicFieldMappingInfo{
		Id:          item.ID,
		Channel:     item.Channel,
		MappingType: item.MappingType,
	}
	mappingInfo.Data = make([]*shadowV1.DynamicFieldMappingItem, 0)
	if len(item.Data) > 0 {
		var mappingData []*shadowV1.DynamicFieldMappingItem
		err := jsonutil.Unmarshal(item.Data, &mappingData)
		if err != nil {
			return mappingInfo, errorx.DataFormattingError.WithError(err).Err()
		}
		mappingInfo.Data = mappingData
	}
	return mappingInfo, nil
}

func (d *DynamicFieldMappingRepo) QueryDynamicFieldMappingList(ctx context.Context, req *shadowV1.GetDynamicFieldMappingListReq) ([]*yanxue_model.DynamicFieldMapping, *condition.Reply, error) {
	page := int32(1)
	pageSize := int32(100)
	if req.GetPage() > 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() > 0 {
		pageSize = req.GetPageSize()
	}
	param := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}
	param.Query = append(param.Query, &condition.QueryParam{
		Field: "channel",
		Value: req.GetChannel(),
		Exp:   condition.EQ,
		Logic: condition.AND,
	})

	list, reply, err := d.FindMultiByCondition(ctx, param)
	if err != nil {
		return list, reply, errorx.DataSQLErr.WithError(err).Err()
	}
	return list, reply, nil
}

// CopyFromChannel 将源渠道的 dynamic_field_mapping 配置复制到新渠道
func (d *DynamicFieldMappingRepo) CopyFromChannel(ctx context.Context, fromChannel, toChannel string) error {
	if fromChannel == "" || toChannel == "" {
		return nil
	}
	param := &condition.Req{
		Page:     1,
		PageSize: 1000,
		Query: []*condition.QueryParam{
			{Field: "channel", Value: fromChannel, Exp: condition.EQ, Logic: condition.AND},
		},
	}
	sourceList, _, err := d.FindMultiByCondition(ctx, param)
	if err != nil {
		return err
	}
	if len(sourceList) == 0 {
		return nil
	}
	now := time.Now()
	newList := make([]*yanxue_model.DynamicFieldMapping, 0, len(sourceList))
	for _, src := range sourceList {
		newItem := &yanxue_model.DynamicFieldMapping{
			Data:        src.Data,
			Channel:     toChannel,
			MappingType: src.MappingType,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		newList = append(newList, newItem)
	}
	return d.CreateBatch(ctx, newList, 100)
}
