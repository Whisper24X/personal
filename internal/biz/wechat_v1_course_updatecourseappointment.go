package biz

import (
	"context"
	"github.com/go-kratos/kratos/v2/errors"
	"net/http"

	idvalidator "github.com/guanguans/id-validator"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/validutil"
)

// UpdateCourseAppointment 课程-更新预约
func (w *WechatV1CourseUseCase) UpdateCourseAppointment(ctx context.Context, req *pb.UpdateCourseAppointmentReq) (*pb.UpdateCourseAppointmentReply, error) {
	resp := &pb.UpdateCourseAppointmentReply{}
	// 校验孩子身份证
	if req.GetStudentIdentityCard() != "" {
		if !idvalidator.IsValid(req.GetStudentIdentityCard(), false) {
			return nil, errorx.ParamIdentityCardInvalid.Err()
		}
	}
	// 校验家长手机号
	if !validutil.IsPhoneLoose(req.GetParentPhone()) {
		return nil, errorx.ParamPhoneInvalid.Err()
	}
	courseAppointment, err := w.courseAppointmentRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if courseAppointment == nil || courseAppointment.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	// 只能更新已预约状态
	if courseAppointment.Status != constant.CourseAppointmentStatusSuccess.String() {
		return nil, errorx.CourseAppointmentStatusNotAllowed.Err()
	}
	// 只能取消未来的日期的预约，上课日期距离当前日期的时间小于 3 天不能取消
	nowCarbon := timeutil.NowCarbon().StartOfDay()
	courseDateCarbon := timeutil.Carbon().Parse(courseAppointment.Date).StartOfDay()
	// 判断上课日期距离当前日期的时间小于 3 天不能取消
	if nowCarbon.DiffInDays(courseDateCarbon) < 3 {
		return nil, errorx.CourseAppointmentCancelTimeNotAllowed.Err()
	}
	// 查询订单信息
	orderInfo, err := w.orderRepo.FindOneCacheByID(ctx, courseAppointment.OrderID)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if orderInfo == nil || orderInfo.ID == "" {
		return nil, errorx.DataSQLErr.Err()
	}
	// 查询商品信息
	goodInfo, err := w.goodRepo.FindOneCacheByID(ctx, courseAppointment.GoodID)
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
	oldCourseAppointment := w.courseAppointmentRepo.DeepCopy(courseAppointment)
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
	parentPh, err := cryptutil.YcPhoneEncrypt(req.GetParentPhone())
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	courseAppointment.Date = req.GetDate()
	courseAppointment.Period = req.GetPeriod()
	courseAppointment.StudentName = req.GetStudentName()
	courseAppointment.StudentIC = studentIC
	courseAppointment.StudentSex = req.GetStudentSex()
	courseAppointment.StudentAge = int16(req.GetStudentAge())
	courseAppointment.ParentName = req.GetParentName()
	courseAppointment.ParentPh = parentPh
	courseAppointment.ParentAccompany = req.GetParentAccompany()
	courseAppointment.ParentRemark = req.GetParentRemark()
	// 校验
	err = w.bffRepo.CheckCourseAppointment(ctx, orderInfo, goodInfo, courseAppointment)
	if err != nil {
		return resp, err
	}
	// 更新
	err = w.courseAppointmentRepo.UpdateOneCacheWithZero(ctx, courseAppointment, oldCourseAppointment)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

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
