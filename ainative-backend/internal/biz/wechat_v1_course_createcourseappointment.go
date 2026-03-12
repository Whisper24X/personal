package biz

import (
	"context"
	"fmt"
	"github.com/go-kratos/kratos/v2/errors"
	"net/http"
	"strings"
	"time"

	"github.com/forPelevin/gomoji"
	idvalidator "github.com/guanguans/id-validator"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/validutil"
)

// UserAppointmentInfo 用户预约信息
type UserAppointmentInfo struct {
	ParentName      string `json:"parentName"`      // 家长姓名
	ParentPhone     string `json:"parentPhone"`     // 家长电话
	ParentAccompany string `json:"parentAccompany"` // 家长是否陪伴
}

func (w *WechatV1CourseUseCase) GetOffiaccountOpenIdByPh(ctx context.Context, ph string) (string, error) {
	userInfo, err := w.userRepo.FindOneByPh(ctx, ph)
	if err != nil {
		return "", errorx.DataSQLErr.WithError(err).Err()
	}
	if userInfo == nil {
		return "", nil
	}
	userWxId := userInfo.UserWxID
	userWxInfo, err := w.userWxRepo.FindOneCacheByID(ctx, userWxId)
	if err != nil {
		return "", errorx.DataSQLErr.WithError(err).Err()
	}
	if userWxInfo == nil {
		return "", nil
	}
	return userWxInfo.OffiaccountOpenID, nil
}

// FormatStartTime 格式化起始时间
// 参数:
//
//	date: 日期字符串，格式为 "2025-11-04" 或 "2025-11-04到2025-11-12"
//	period: 时间段字符串，格式为空或 "11:00-12:00"
//
// 返回值:
//
//	格式化后的起始时间字符串
func FormatStartTime(date, period string) string {
	// 提取起始日期
	var startDate string
	if strings.Contains(date, "到") {
		// 处理日期范围，取第一个日期
		parts := strings.Split(date, "到")
		if len(parts) >= 2 {
			startDate = strings.TrimSpace(parts[0])
		} else {
			startDate = strings.TrimSpace(date)
		}
	} else {
		// 单个日期
		startDate = strings.TrimSpace(date)
	}

	// 验证日期格式
	_, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return "无效的日期格式"
	}

	// 处理时间段
	if period != "" {
		// 提取起始时间
		timeParts := strings.Split(period, "-")
		if len(timeParts) >= 2 {
			startTime := strings.TrimSpace(timeParts[0])

			// 验证时间格式
			_, err := time.Parse("15:04", startTime)
			if err != nil {
				return "无效的时间格式"
			}

			// 组合日期和时间
			return fmt.Sprintf("%s %s", startDate, startTime)
		}
	}

	// 如果没有时间段或时间段格式不正确，只返回日期
	return startDate
}

// CreateCourseAppointment 课程-预约
func (w *WechatV1CourseUseCase) CreateCourseAppointment(ctx context.Context, req *pb.CreateCourseAppointmentReq) (*pb.CreateCourseAppointmentReply, error) {
	resp := &pb.CreateCourseAppointmentReply{}
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
	// 课程日期今日不可预约
	nowCarbon := timeutil.NowCarbon()
	courseDateCarbon := timeutil.Carbon().Parse(req.GetDate())
	if nowCarbon.Gte(courseDateCarbon) {
		return nil, errorx.CourseAppointmentCreateTimeNotAllowed.Err()
	}
	// 多日营不需要时段
	periods := strings.Split(req.GetPeriod(), "-")
	if len(periods) != 2 {
		periods = append(periods, "")
		periods = append(periods, "")
		//return nil, errorx.ParamValidationErr.Err()
	}
	// 查询订单信息
	orderInfo, err := w.orderRepo.FindOneCacheByID(ctx, req.GetOrderId())
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
	goodInfo, err := w.goodRepo.FindOneCacheByID(ctx, orderInfo.GoodID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if goodInfo == nil || goodInfo.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	// 查询渠道商品信息
	platformGoodInfo, err := w.platformGoodRepo.FindOneCacheByID(ctx, goodInfo.PlatformGoodID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	studentIC := ""
	if req.GetStudentIdentityCard() != "" {
		studentIC, err = cryptutil.YcCardEncrypt(req.GetStudentIdentityCard())
		if err != nil {
			return nil, errorx.DataFormattingError.WithError(err).Err()
		}
	}
	// 如果是多日营，则必须有身份证ID
	if platformGoodInfo.GoodType == string(constant.GoodTypeMulti) && studentIC == "" {
		return nil, errors.New(http.StatusBadRequest, "-1", "多日营预约必须填写身份证!")
	}
	parentPhone, err := cryptutil.YcPhoneEncrypt(req.GetParentPhone())
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	courseAppointment := &yanxue_model.CourseAppointment{
		OrderID:          req.GetOrderId(),
		GoodID:           orderInfo.GoodID,
		CategoryID:       req.GetCategoryId(),
		CourseID:         req.GetCourseId(),
		Date:             req.GetDate(),
		Period:           req.GetPeriod(),
		PeriodStartTime:  periods[0],
		PeriodEndTime:    periods[1],
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
		ParentRemark:     req.GetParentRemark(),
	}
	err = w.bffRepo.CheckCourseAppointment(ctx, orderInfo, goodInfo, courseAppointment)
	if err != nil {
		return resp, err
	}
	err = w.courseAppointmentRepo.CreateOneCache(ctx, courseAppointment)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	// 预约成功，发送微信模版消息
	go func(ph, courseId, date, period string) {
		offiaccountOpenId, err := w.GetOffiaccountOpenIdByPh(context.Background(), ph)
		if err != nil {
			w.log.Errorf("通过手机号查询用户公众号openId失败！手机号：%s", ph)
		}
		courseInfo, err := w.courseRepo.FindOneCacheByID(context.Background(), courseId)
		if err != nil {
			w.log.Warn("查找不到课程信息，发送模版消息失败！")
		}
		appointmentTime := FormatStartTime(date, period)
		if offiaccountOpenId != "" {
			wechatOrderNumber := UUIDTo32String(orderInfo.OrderNumber)
			w.userMessageRepo.SendOfficialAccountAppointmentRemindNotice(context.Background(), offiaccountOpenId, orderInfo.ID, wechatOrderNumber, courseInfo.CourseName, appointmentTime)
		}
	}(orderInfo.Ph, req.GetCourseId(), req.GetDate(), req.GetPeriod())

	// 查询该订单的子订单列表
	subOrders, err := w.subOrderRepo.FindMultiByParentOrderID(ctx, orderInfo.ID)
	if err != nil {
		w.log.Errorf("查询子订单失败，orderId=%s, err=%v", orderInfo.ID, err)
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
		oldSubOrder := w.subOrderRepo.DeepCopy(targetSubOrder)
		targetSubOrder.ServiceStatus = string(constant.OrderStatusSuccess) // 已预约

		err = w.subOrderRepo.UpdateOneCache(ctx, targetSubOrder, oldSubOrder)
		if err != nil {
			w.log.Errorf("更新子订单状态失败，subOrderId=%s, err=%v", targetSubOrder.ID, err)
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
			oldOrderInfo := w.orderRepo.DeepCopy(orderInfo)
			orderInfo.ServiceStatus = constant.OrderStatusSuccess.String()
			err = w.orderRepo.UpdateOneCacheWithZero(ctx, orderInfo, oldOrderInfo)
			if err != nil {
				w.log.Errorf("更新父订单状态失败，orderId=%s, err=%v", orderInfo.ID, err)
			}
		}
	} else {
		// 没有子订单时的处理（老订单或拆单失败的订单）
		if orderInfo.ServiceStatus == constant.OrderStatusPending.String() {
			oldOrderInfo := w.orderRepo.DeepCopy(orderInfo)
			orderInfo.ServiceStatus = constant.OrderStatusSuccess.String()
			err = w.orderRepo.UpdateOneCacheWithZero(ctx, orderInfo, oldOrderInfo)
			if err != nil {
				return nil, errorx.DataSQLErr.WithError(err).Err()
			}
		}
	}

	resp.Id = courseAppointment.ID

	// 发送飞书通知
	go func(req *pb.CreateCourseAppointmentReq, orderNumber string) {
		courseInfo, err := w.courseRepo.FindOneCacheByID(context.Background(), req.GetCourseId())
		if err != nil {
			w.log.Warn("查找不到课程信息，发送飞书通知失败")
			return
		}
		appointmentList, err := w.courseAppointmentRepo.FindMultiByCourseIDDatePeriod(context.Background(), req.GetCourseId(), req.GetDate(), req.GetPeriod())
		if err != nil {
			w.log.Warn("查找不到课程预约信息，发送飞书通知失败")
			return
		}
		appointmentCount := 0
		for _, appointment := range appointmentList {
			if appointment.Status == constant.CourseAppointmentStatusCancel.String() {
				continue
			}
			appointmentCount++
		}
		w.courseAppointmentRepo.CreateCourseAppointmentFeiShuNotify(context.Background(), courseInfo.CourseName, req.GetDate()+" "+req.GetPeriod(), req.GetStudentName(), req.GetParentPhone(), orderInfo.OrderNumber, int32(appointmentCount))
	}(req, orderInfo.OrderNumber)

	userId := meta.GetUserID(ctx)
	// 写入用户信息
	go func(userId, parentName, parentPhone, parentAccompany string) {
		user, err := w.userRepo.FindOneCacheByID(context.Background(), userId)
		if err != nil {
			w.log.Errorf("预约写入用户信息，查询用户信息失败！err: %s", err.Error())
			return
		}
		if user == nil || user.ID == "" {
			w.log.Errorf("预约写入用户信息，查询用户的信息为空！")
			return
		}
		oldUserInfo := w.userRepo.DeepCopy(user)
		userInfo := UserAppointmentInfo{
			ParentName:      parentName,
			ParentPhone:     parentPhone,
			ParentAccompany: parentAccompany,
		}
		userInfoJson, err := jsonutil.Marshal(userInfo)
		if err != nil {
			w.log.Errorf("预约写入用户信息，序列化失败！err: %s", err.Error())
			return
		}
		user.UserAppointmentInfo = userInfoJson
		err = w.userRepo.UpdateOneCache(context.Background(), user, oldUserInfo)
		if err != nil {
			w.log.Errorf("预约写入用户信息失败！err: %s", err.Error())
			return
		}
	}(userId, req.GetParentName(), req.GetParentPhone(), req.GetParentAccompany())
	return resp, nil
}
