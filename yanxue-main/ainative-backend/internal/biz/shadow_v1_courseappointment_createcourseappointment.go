package biz

import (
	"context"
	"net/http"
	"strings"

	"github.com/forPelevin/gomoji"
	"github.com/go-kratos/kratos/v2/errors"
	idvalidator "github.com/guanguans/id-validator"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/validutil"
)

func (s *ShadowV1CourseAppointmentUseCase) GetOffiaccountOpenIdByPh(ctx context.Context, ph string) (string, error) {
	userInfo, err := s.userRepo.FindOneByPh(ctx, ph)
	if err != nil {
		return "", errorx.DataSQLErr.WithError(err).Err()
	}
	if userInfo == nil {
		return "", nil
	}
	userWxId := userInfo.UserWxID
	userWxInfo, err := s.userWxRepo.FindOneCacheByID(ctx, userWxId)
	if err != nil {
		return "", errorx.DataSQLErr.WithError(err).Err()
	}
	if userWxInfo == nil {
		return "", nil
	}
	return userWxInfo.OffiaccountOpenID, nil
}

// CreateCourseAppointment 课程-预约
func (s *ShadowV1CourseAppointmentUseCase) CreateCourseAppointment(ctx context.Context, req *pb.CreateCourseAppointmentReq) (*pb.CreateCourseAppointmentReply, error) {
	resp := &pb.CreateCourseAppointmentReply{
		Id: "",
	}
	// 验证学生姓名是否包含表情符号
	if gomoji.ContainsEmoji(req.GetStudentName()) {
		return nil, errorx.ParamEmojiInvalid.Err()
	}
	// 校验孩子身份证
	if req.GetStudentIdentityCard() != "" {
		if !idvalidator.IsValid(req.GetStudentIdentityCard(), false) {
			return nil, errorx.ParamIdentityCardInvalid.Err()
		}
	}
	// 验证家长姓名是否包含表情符号
	if gomoji.ContainsEmoji(req.GetParentName()) {
		return nil, errorx.ParamEmojiInvalid.Err()
	}
	// 校验家长手机号
	if !validutil.IsPhoneLoose(req.GetParentPhone()) {
		return nil, errorx.ParamPhoneInvalid.Err()
	}
	periods := strings.Split(req.GetPeriod(), "-")
	periodStartTime := ""
	periodEndTime := ""
	if len(periods) == 2 {
		periodStartTime = periods[0]
		periodEndTime = periods[1]
	}
	// 查询订单信息
	orderInfo, err := s.orderRepo.FindOneCacheByID(ctx, req.GetOrderId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if orderInfo == nil || orderInfo.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	// 订单状态为退款中或已退款，不可预约
	if orderInfo.Status == string(constant.OrderStatusRefunded) ||
		orderInfo.Status == string(constant.OrderStatusRefunding) {
		return nil, errors.New(http.StatusBadRequest, "-1", "订单状态为退款中或已退款，不可预约!")
	}
	// 查询商品信息
	goodInfo, err := s.goodRepo.FindOneCacheByID(ctx, orderInfo.GoodID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if goodInfo == nil || goodInfo.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	studentIC := ""
	if req.GetStudentIdentityCard() != "" {
		studentIC, err = cryptutil.YcCardEncrypt(req.GetStudentIdentityCard())
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}
	parentPhone, err := cryptutil.YcPhoneEncrypt(req.GetParentPhone())
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	data := &yanxue_model.CourseAppointment{
		OrderID:          req.GetOrderId(),
		GoodID:           orderInfo.GoodID,
		CategoryID:       req.GetCategoryId(),
		CourseID:         req.GetCourseId(),
		Date:             req.GetDate(),
		Period:           req.GetPeriod(),
		PeriodStartTime:  periodStartTime,
		PeriodEndTime:    periodEndTime,
		StudentName:      req.GetStudentName(),
		StudentIC:        studentIC,
		StudentAge:       int16(req.GetStudentAge()),
		StudentSex:       req.GetStudentSex(),
		ParentName:       req.GetParentName(),
		ParentPh:         parentPhone,
		ParentAccompany:  req.GetParentAccompany(),
		VerificationCode: req.GetVerificationCode(),
		Status:           constant.CourseAppointmentStatusSuccess.String(),
		ContractStatus:   constant.ContractStatusPending,
		BusinessRemark:   req.GetBusinessRemark(),
	}
	err = s.bffRepo.CheckCourseAppointment(ctx, orderInfo, goodInfo, data)
	if err != nil {
		return resp, err
	}
	err = s.courseAppointmentRepo.CreateOneCache(ctx, data)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 预约成功，发送微信模版消息
	go func(ph, courseId, date, period string) {
		offiaccountOpenId, err := s.GetOffiaccountOpenIdByPh(context.Background(), ph)
		if err != nil {
			s.log.Errorf("通过手机号查询用户公众号openId失败！手机号：%s", ph)
		}
		courseInfo, err := s.courseRepo.FindOneCacheByID(context.Background(), courseId)
		if err != nil {
			s.log.Warn("查找不到课程信息，发送模版消息失败！")
		}
		appointmentTime := FormatStartTime(date, period)
		if offiaccountOpenId != "" {
			wechatOrderNumber := UUIDTo32String(orderInfo.OrderNumber)
			s.userMessageRepo.SendOfficialAccountAppointmentRemindNotice(context.Background(), offiaccountOpenId, orderInfo.ID, wechatOrderNumber, courseInfo.CourseName, appointmentTime)
		}
	}(orderInfo.Ph, req.GetCourseId(), req.GetDate(), req.GetPeriod())

	// 查询该订单的子订单列表
	subOrders, err := s.subOrderRepo.FindMultiByParentOrderID(ctx, orderInfo.ID)
	if err != nil {
		s.log.Errorf("查询子订单失败，orderId=%s, err=%v", orderInfo.ID, err)
		// 查询失败不影响主流程，继续使用原有逻辑
		subOrders = nil
	}

	// 找到第一个待预约状态的子订单
	var targetSubOrder *yanxue_model.SubOrder
	if len(subOrders) > 0 {
		for _, subOrder := range subOrders {
			if subOrder.ServiceStatus == string(constant.OrderStatusPending) {
				targetSubOrder = subOrder
				break
			}
		}

		if targetSubOrder == nil {
			// 所有子订单都已使用
			return nil, errors.New(http.StatusBadRequest, "-1", "该订单的所有使用次数已用完")
		}
	}

	// 如果有子订单，更新子订单状态
	if targetSubOrder != nil {
		oldSubOrder := s.subOrderRepo.DeepCopy(targetSubOrder)
		targetSubOrder.ServiceStatus = string(constant.OrderStatusSuccess) // 已预约

		err = s.subOrderRepo.UpdateOneCache(ctx, targetSubOrder, oldSubOrder)
		if err != nil {
			s.log.Errorf("更新子订单状态失败，subOrderId=%s, err=%v", targetSubOrder.ID, err)
			// 更新失败不影响主流程
		}

		// 检查是否所有子订单都已预约，如果是，更新父订单状态
		allUsed := true
		for _, subOrder := range subOrders {
			if subOrder.ID == targetSubOrder.ID {
				continue // 跳过刚更新的
			}
			if subOrder.ServiceStatus == string(constant.OrderStatusPending) {
				allUsed = false
				break
			}
		}

		// 如果所有子订单都已使用，更新父订单为已预约
		if allUsed && orderInfo.ServiceStatus == constant.OrderStatusPending.String() {
			oldOrderInfo := s.orderRepo.DeepCopy(orderInfo)
			orderInfo.ServiceStatus = constant.OrderStatusSuccess.String()
			err = s.orderRepo.UpdateOneCacheWithZero(ctx, orderInfo, oldOrderInfo)
			if err != nil {
				s.log.Errorf("更新父订单状态失败，orderId=%s, err=%v", orderInfo.ID, err)
			}
		}
	} else {
		// 没有子订单时的处理（老订单或拆单失败的订单）
		if orderInfo.ServiceStatus == constant.OrderStatusPending.String() {
			oldOrderInfo := s.orderRepo.DeepCopy(orderInfo)
			orderInfo.ServiceStatus = constant.OrderStatusSuccess.String()
			err = s.orderRepo.UpdateOneCacheWithZero(ctx, orderInfo, oldOrderInfo)
			if err != nil {
				return nil, errorx.DataSQLErr.WithError(err).Err()
			}
		}
	}

	resp.Id = data.ID

	// 发送飞书通知
	go func(req *pb.CreateCourseAppointmentReq, orderNumber string) {
		courseInfo, err := s.courseRepo.FindOneCacheByID(context.Background(), req.GetCourseId())
		if err != nil {
			s.log.Warn("查找不到课程信息，发送飞书通知失败")
			return
		}
		appointmentList, err := s.courseAppointmentRepo.FindMultiByCourseIDDatePeriod(context.Background(), req.GetCourseId(), req.GetDate(), req.GetPeriod())
		if err != nil {
			s.log.Warn("查找不到课程预约信息，发送飞书通知失败")
			return
		}
		appointmentCount := 0
		for _, appointment := range appointmentList {
			if appointment.Status == constant.CourseAppointmentStatusCancel.String() {
				continue
			}
			appointmentCount++
		}
		s.courseAppointmentRepo.CreateCourseAppointmentFeiShuNotify(context.Background(), courseInfo.CourseName, req.GetDate()+" "+req.GetPeriod(), req.GetStudentName(), req.GetParentPhone(), orderInfo.OrderNumber, int32(appointmentCount))
	}(req, orderInfo.OrderNumber)

	return resp, nil
}
