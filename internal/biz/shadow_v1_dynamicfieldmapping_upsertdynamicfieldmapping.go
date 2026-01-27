package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// UpsertDynamicFieldMapping 动态字段映射关系表-创建/更新一条数据
func (s *ShadowV1DynamicFieldMappingUseCase) UpsertDynamicFieldMapping(ctx context.Context, req *pb.UpsertDynamicFieldMappingReq) (*pb.UpsertDynamicFieldMappingReply, error) {
	resp := &pb.UpsertDynamicFieldMappingReply{}
	resp.Id = req.GetId()
	adminId := meta.GetAdminID(ctx)
	// 如果不为空，则更新
	if req.GetId() != "" {
		// 查询是否有数据
		mappingInfo, err := s.dynamicFieldMappingRepo.FindOneCacheByID(ctx, req.GetId())
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		oldMappingInfo := s.dynamicFieldMappingRepo.DeepCopy(mappingInfo)
		data, err := jsonutil.Marshal(req.GetData())
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		mappingInfo.Data = data
		mappingInfo.UpdatedBy = adminId
		err = s.dynamicFieldMappingRepo.UpdateOneCache(ctx, mappingInfo, oldMappingInfo)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
	} else { // 新增
		data, err := jsonutil.Marshal(req.GetData())
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		if req.GetChannel() != constant.ChannelTypeDY &&
			req.GetChannel() != constant.ChannelTypeWD &&
			req.GetChannel() != constant.ChannelTypeSPHXD {
			return resp, errors.New(http.StatusBadRequest, "-1", "渠道只支持抖音,微店和视频号！")
		}
		if req.GetMappingType() != constant.MappingTypeEnum &&
			req.GetMappingType() != constant.MappingTypeField &&
			req.GetMappingType() != constant.MappingTypeServiceStatusEnum {
			return resp, errors.New(http.StatusBadRequest, "-1", "映射类型只支持enum, field和serviceStatusEnum！")
		}
		addData := &yanxue_model.DynamicFieldMapping{
			Data:        data,
			Channel:     req.GetChannel(),
			MappingType: req.GetMappingType(),
			UpdatedBy:   adminId,
		}
		err = s.dynamicFieldMappingRepo.CreateOne(ctx, addData)
		if err != nil {
			return resp, errorx.DataSQLErr.WithError(err).Err()
		}
		resp.Id = addData.ID
	}
	return resp, nil
}
