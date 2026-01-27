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
	"gorm.io/datatypes"
)

// UpdateCouponStatus 优惠券表-更新优惠券状态
func (s *ShadowV1CouponUseCase) UpdateCouponStatus(ctx context.Context, req *pb.UpdateCouponStatusReq) (*pb.UpdateCouponStatusReply, error) {
	// 参数验证
	if err := req.Validate(); err != nil {
		return nil, err
	}
	adminId := meta.GetAdminID(ctx)

	if req.Status != string(constant.CouponStatusPutOff) &&
		req.Status != string(constant.CouponStatusPutOn) {
		return nil, errors.New(http.StatusBadRequest, "-1", "status参数错误!")
	}
	// 根据ID查询优惠券
	coupon, err := s.couponRepo.FindOneByID(ctx, req.Id)
	if err != nil {
		s.log.Errorf("UpdateCouponStatus find coupon failed: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 检查数据是否存在
	if coupon == nil {
		return nil, nil
	}

	// 保存旧数据用于缓存删除
	oldCoupon := s.couponRepo.DeepCopy(coupon)

	// 更新状态
	coupon.Status = req.Status

	// 更新数据库
	if err := s.couponRepo.UpdateOneCache(ctx, coupon, oldCoupon); err != nil {
		s.log.Errorf("UpdateCouponStatus update failed: %v", err)
		return nil, err
	}

	// 写操作日志
	operationType := ""
	if req.Status == string(constant.CouponStatusPutOn) {
		operationType = constant.OperationTypePutOnCoupon
	}
	if req.Status == string(constant.CouponStatusPutOff) {
		operationType = constant.OperationTypePutOffCoupon
	}
	_ = s.sysDataLogRepo.CreateOneCache(ctx, &yanxue_model.SysDataLog{
		OperationType: operationType,
		OperatorID:    coupon.ID,
		OldData:       datatypes.JSON{},
		NewData:       datatypes.JSON{},
		UpdatedBy:     adminId,
		Module:        constant.ModuleTypeCoupon,
	})

	// 返回结果
	resp := &pb.UpdateCouponStatusReply{}
	return resp, nil
}
