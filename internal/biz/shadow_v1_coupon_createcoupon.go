package biz

import (
	"context"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
	"net/http"
	"regexp"
	"time"
	"unicode/utf8"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gorm.io/datatypes"
)

// CreateCoupon 优惠券表-创建一条数据
func (s *ShadowV1CouponUseCase) CreateCoupon(ctx context.Context, req *pb.CreateCouponReq) (*pb.CreateCouponReply, error) {
	// 参数验证
	if err := req.Validate(); err != nil {
		return nil, err
	}
	adminId := meta.GetAdminID(ctx)

	// 详细校验规则
	if err := s.validateCreateCouponReq(req); err != nil {
		return nil, err
	}

	// 创建优惠券
	coupon := &yanxue_model.Coupon{
		ID:              req.Id,
		Name:            req.Name,
		DiscountAmount:  req.DiscountAmount,
		PushType:        req.PushType,
		CouponType:      req.CouponType,
		MinAmount:       req.MinAmount,
		ValidStartTime:  time.Time{},
		ValidEndTime:    time.Time{},
		ClaimStartTime:  time.Time{},
		ClaimEndTime:    time.Time{},
		TotalStock:      req.TotalStock,
		LimitPerUser:    req.LimitPerUser,
		Remark:          req.Remark,
		ShareQRCode:     req.ShareQRCode,
		Status:          string(constant.CouponStatusPutOff), // 默认下架状态
		CouponValidDays: req.CouponValidDays,
	}

	// 处理时间字段
	if req.ValidStartTime != "" {
		validStartTime := timeutil.Carbon().Parse(req.ValidStartTime).ToStdTime()
		coupon.ValidStartTime = validStartTime
	}
	if req.ValidEndTime != "" {
		validEndTime := timeutil.Carbon().Parse(req.ValidEndTime).ToStdTime()
		coupon.ValidEndTime = validEndTime
	}
	if req.ClaimStartTime != "" {
		claimStartTime := timeutil.Carbon().Parse(req.ClaimStartTime).ToStdTime()
		coupon.ClaimStartTime = claimStartTime
	}
	if req.ClaimEndTime != "" {
		claimEndTime := timeutil.Carbon().Parse(req.ClaimEndTime).ToStdTime()
		coupon.ClaimEndTime = claimEndTime
	}

	// 处理适用商品信息
	if len(req.AdaptGoodInfo) > 0 {
		// 这里需要将字符串数组转换为JSON格式存储
		// 简化处理，实际项目中可能需要更复杂的转换
		adaptGoodInfo, err := jsonutil.Marshal(req.AdaptGoodInfo)
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
		coupon.AdaptGoodInfo = adaptGoodInfo
	}

	// 保存到数据库
	if err := s.couponRepo.CreateOne(ctx, coupon); err != nil {
		s.log.Errorf("CreateCoupon failed: %v", err)
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 写操作日志
	_ = s.sysDataLogRepo.CreateOneCache(ctx, &yanxue_model.SysDataLog{
		OperationType: constant.OperationTypeCreateCoupon,
		OperatorID:    coupon.ID,
		OldData:       datatypes.JSON{},
		NewData:       datatypes.JSON{},
		UpdatedBy:     adminId,
		Module:        constant.ModuleTypeCoupon,
	})

	// 返回结果
	resp := &pb.CreateCouponReply{
		Id: coupon.ID,
	}
	return resp, nil
}

// validateCreateCouponReq 验证CreateCoupon请求参数
func (s *ShadowV1CouponUseCase) validateCreateCouponReq(req *pb.CreateCouponReq) error {
	// 校验名称：支持汉字，数字，字母输入，长度不超过20
	if req.Name == "" {
		return errors.New(http.StatusBadRequest, "-1", "优惠券名称不能为空！")
	}
	if utf8.RuneCountInString(req.Name) > 20 {
		return errors.New(http.StatusBadRequest, "-1", "优惠券名称长度不能超过20个字符！")
	}
	// 校验名称只能包含汉字、数字、字母
	if !isValidCouponName(req.Name) {
		return errors.New(http.StatusBadRequest, "-1", "优惠券名称只能包含汉字、数字、字母！")
	}

	// 校验优惠金额：支持数字输入，长度不超过6
	if req.DiscountAmount <= 0 {
		return errors.New(http.StatusBadRequest, "-1", "优惠金额必须大于0！")
	}
	if req.DiscountAmount > 999999 {
		return errors.New(http.StatusBadRequest, "-1", "优惠金额不能超过999999！")
	}

	// 校验投放张数：支持数字输入，长度不超过8
	if req.TotalStock <= 0 {
		return errors.New(http.StatusBadRequest, "-1", "投放张数必须大于0！")
	}
	if req.TotalStock > 99999999 {
		return errors.New(http.StatusBadRequest, "-1", "投放张数不能超过99999999！")
	}

	// 校验每人限领：支持数字输入，长度不超过2
	if req.LimitPerUser <= 0 {
		return errors.New(http.StatusBadRequest, "-1", "每人限领张数必须大于0！")
	}
	if req.LimitPerUser > 99 {
		return errors.New(http.StatusBadRequest, "-1", "每人限领张数不能超过99！")
	}

	// 校验备注：支持汉字，数字，字母输入，长度不超过200
	if req.Remark != "" && utf8.RuneCountInString(req.Remark) > 200 {
		return errors.New(http.StatusBadRequest, "-1", "备注长度不能超过200个字符！")
	}

	// 校验门槛金额
	if req.MinAmount < 0 {
		return errors.New(http.StatusBadRequest, "-1", "门槛金额不能为负数！")
	}

	// 校验推送类型
	if req.GetPushType() != string(constant.CouponPushTypePublic) &&
		req.GetPushType() != string(constant.CouponPushTypePrivate) {
		return errors.New(http.StatusBadRequest, "-1", "推送类型错误！")
	}
	// 校验优惠券类型
	if req.GetCouponType() != string(constant.CouponTypeCommon) &&
		req.GetCouponType() != string(constant.CouponTypeGood) {
		return errors.New(http.StatusBadRequest, "-1", "优惠券类型错误！")
	}

	return nil
}

// isValidCouponName 校验优惠券名称是否合法（支持汉字、数字、字母）
func isValidCouponName(name string) bool {
	// 使用正则表达式校验：支持汉字、数字、字母
	// \p{Han} 匹配汉字
	// a-zA-Z 匹配字母
	// 0-9 匹配数字
	pattern := `^[\p{Han}a-zA-Z0-9]+$`
	matched, err := regexp.MatchString(pattern, name)
	if err != nil {
		return false
	}
	return matched
}
