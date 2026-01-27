package data

import (
	"context"
	"strings"
	"time"

	"github.com/FrancisLv/PowerWeChat/v3/src/kernel/power"
	templateMessage "github.com/FrancisLv/PowerWeChat/v3/src/officialAccount/templateMessage/request"
	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.UserMessageRepo = (*UserMessageRepo)(nil)

func NewUserMessageRepo(
	cfg *conf.Bootstrap,
	logger log.Logger,
	data *Data,
	userMessageRepo *yanxue_repo.UserMessageRepo,
) biz.UserMessageRepo {
	l := log.NewHelper(log.With(logger, "module", "data/userMessage"), log.WithMessageKey("message"))
	return &UserMessageRepo{
		cfg:             cfg,
		log:             l,
		data:            data,
		UserMessageRepo: userMessageRepo,
	}
}

type UserMessageRepo struct {
	cfg  *conf.Bootstrap
	log  *log.Helper
	data *Data
	*yanxue_repo.UserMessageRepo
}

// SendOfficialAccountCheckInSuccessNotice公众号-发送签到成功通知
func (s *UserMessageRepo) SendOfficialAccountCheckInSuccessNotice(ctx context.Context, officialAccountOpenId string, studentName string, storeName string, appointmentId string, checkInTime time.Time) error {
	_, err := s.data.officialAccountClient.TemplateMessage.Send(ctx, &templateMessage.RequestTemlateMessage{
		ToUser:     officialAccountOpenId,
		TemplateID: s.cfg.OfficialAccount.TemplateId["signInReminder"],
		URL:        "",
		MiniProgram: &templateMessage.MiniProgram{
			AppID:    s.cfg.OfficialAccount.AppID,
			PagePath: "pages/reservation-detail/index?id=" + appointmentId,
		},
		Data: &power.HashMap{
			"thing5": power.StringMap{
				"value": studentName, //姓名  李小明
				"color": "#173177",
			},
			"thing2": power.StringMap{
				"value": storeName, //地点  未来书房
				"color": "#173177",
			},
			"time4": power.StringMap{
				"value": checkInTime.Format("15:04"), //签到时间 22：22
				"color": "#173177",
			},
		},
	})
	if err != nil {
		return err
	}
	return nil
}

// SendOfficialAccountLeaveReminderNotice 公众号-发送离店提醒通知
func (s *UserMessageRepo) SendOfficialAccountLeaveReminderNotice(ctx context.Context, officialAccountOpenId string, studentName string, storeName string, appointmentId string, leaveTime time.Time) error {
	_, err := s.data.officialAccountClient.TemplateMessage.Send(ctx, &templateMessage.RequestTemlateMessage{
		ToUser:     officialAccountOpenId,
		TemplateID: s.cfg.OfficialAccount.TemplateId["leaveReminder"],
		URL:        "",
		MiniProgram: &templateMessage.MiniProgram{
			AppID:    s.cfg.OfficialAccount.AppID,
			PagePath: "pages/reservation-detail/index?id=" + appointmentId,
		},
		Data: &power.HashMap{
			"thing2": power.StringMap{
				"value": studentName, //学生姓名  李小明
				"color": "#173177",
			},
			"time3": power.StringMap{
				"value": timeutil.Time2Carbon(leaveTime).Layout("2006年01月02日 15:04:05"), //签离时间  2023年11月16日 16:40:00
				"color": "#173177",
			},
			"thing4": power.StringMap{
				"value": storeName, //签退地点 三年级1班
				"color": "#173177",
			},
		},
	})
	if err != nil {
		return err
	}
	return nil
}

// SendOfficialAccountAppointmentCancelNotice 公众号-预约取消提醒
func (s *UserMessageRepo) SendOfficialAccountAppointmentCancelNotice(ctx context.Context, officialAccountOpenId string, studentName string, storeName string, appointmentId string, date string, periodRangeTime string) error {
	_, err := s.data.officialAccountClient.TemplateMessage.Send(ctx, &templateMessage.RequestTemlateMessage{
		ToUser:     officialAccountOpenId,
		TemplateID: s.cfg.OfficialAccount.TemplateId["appointmentCancel"],
		URL:        "",
		MiniProgram: &templateMessage.MiniProgram{
			AppID:    s.cfg.OfficialAccount.AppID,
			PagePath: "pages/reservation-detail/index?id=" + appointmentId,
		},
		Data: &power.HashMap{
			"thing39": power.StringMap{
				"value": storeName, //自习室名称  李小明
				"color": "#173177",
			},
			"thing10": power.StringMap{
				"value": studentName, //预约人  张三
				"color": "#173177",
			},
			"time59": power.StringMap{
				"value": timeutil.Carbon().Parse(date).Layout("2006年01月02日") + " " + strings.ReplaceAll(periodRangeTime, "-", "~"), //预约时段 2024年12月09日 14:00~15:00
				"color": "#173177",
			},
		},
	})
	if err != nil {
		return err
	}
	return nil
}

// SendOfficialAccountAppointmentChangeNotice 公众号-预约变更提醒
func (s *UserMessageRepo) SendOfficialAccountAppointmentChangeNotice(ctx context.Context, officialAccountOpenId string, studentName string, storeName string, appointmentId string, oldDate string, oldPeriodRangeTime string, newDate string, newPeriodRangeTime string, seatNumber string) error {
	_, err := s.data.officialAccountClient.TemplateMessage.Send(ctx, &templateMessage.RequestTemlateMessage{
		ToUser:     officialAccountOpenId,
		TemplateID: s.cfg.OfficialAccount.TemplateId["appointmentChange"],
		URL:        "",
		MiniProgram: &templateMessage.MiniProgram{
			AppID:    s.cfg.OfficialAccount.AppID,
			PagePath: "pages/reservation-detail/index?id=" + appointmentId,
		},
		Data: &power.HashMap{
			"thing17": power.StringMap{
				"value": studentName, //学生姓名  李小明
				"color": "#173177",
			},
			"time4": power.StringMap{
				"value": timeutil.Carbon().Parse(oldDate).Layout("2006年01月02日") + " " + strings.ReplaceAll(oldPeriodRangeTime, "-", "~"), //原上课时间 2024年12月09日 14:00~15:00
				"color": "#173177",
			},
			"time5": power.StringMap{
				"value": timeutil.Carbon().Parse(newDate).Layout("2006年01月02日") + " " + strings.ReplaceAll(newPeriodRangeTime, "-", "~"), //新上课时间 2024年12月09日 14:00~15:00
				"color": "#173177",
			},
			"thing7": power.StringMap{
				"value": seatNumber, //新课程地点  A03
				"color": "#173177",
			},
		},
	})
	if err != nil {
		return err
	}
	return nil
}

// SendOfficialOrderRefundSuccessNotice 公众号-退款成功通知
func (s *UserMessageRepo) SendOfficialOrderRefundSuccessNotice(ctx context.Context, officialAccountOpenId string, orderId, orderNumber, goodName, refundAmount string) error {
	resp, err := s.data.officialAccountClient.TemplateMessage.Send(ctx, &templateMessage.RequestTemlateMessage{
		ToUser:     officialAccountOpenId,
		TemplateID: s.cfg.OfficialAccount.TemplateId["orderRefundSuccess"],
		URL:        "",
		MiniProgram: &templateMessage.MiniProgram{
			AppID:    s.cfg.Xcx.AppID,
			PagePath: "/pages/order/refunded/index?orderId=" + orderId,
		},
		Data: &power.HashMap{
			"character_string4": power.StringMap{
				"value": orderNumber, //订单编号
				"color": "#173177",
			},
			"thing1": power.StringMap{
				"value": goodName, //商品名称
				"color": "#173177",
			},
			"amount3": power.StringMap{
				"value": refundAmount, //退款金额
				"color": "#173177",
			},
		},
	})
	s.log.Infof("SendOfficialOrderRefundSuccessNotice errCode:%d errMsg:%s, resultCode:%d, resultMsg:%s", resp.ErrCode, resp.ErrMsg, resp.ResultCode, resp.ResultMsg)
	if err != nil {
		s.log.Errorf("公众号发送退款成功通知失败！订单编号:%s, err:%v", orderNumber, err)
		return err
	}
	return nil
}

// SendOfficialOrderPaySuccessNotice 公众号-支付成功通知
func (s *UserMessageRepo) SendOfficialOrderPaySuccessNotice(ctx context.Context, officialAccountOpenId string, orderId, orderNumber, goodName, amount, paymentTime string) error {
	resp, err := s.data.officialAccountClient.TemplateMessage.Send(ctx, &templateMessage.RequestTemlateMessage{
		ToUser:     officialAccountOpenId,
		TemplateID: s.cfg.OfficialAccount.TemplateId["orderPaySuccess"],
		URL:        "",
		MiniProgram: &templateMessage.MiniProgram{
			AppID:    s.cfg.Xcx.AppID,
			PagePath: "/pages/order/payment-success/index?orderId=" + orderId,
		},
		Data: &power.HashMap{
			"character_string1": power.StringMap{
				"value": orderNumber, //订单编号
				"color": "#173177",
			},
			"thing7": power.StringMap{
				"value": goodName, //商品名称
				"color": "#173177",
			},
			"amount4": power.StringMap{
				"value": amount, //支付金额
				"color": "#173177",
			},
			"time5": power.StringMap{
				"value": paymentTime, //支付时间
				"color": "#173177",
			},
		},
	})
	s.log.Infof("SendOfficialOrderPaySuccessNotice errCode:%d errMsg:%s, resultCode:%d, resultMsg:%s", resp.ErrCode, resp.ErrMsg, resp.ResultCode, resp.ResultMsg)
	if err != nil {
		s.log.Errorf("公众号发送支付成功通知失败！订单编号: %s, err:%v", orderNumber, err)
		return err
	}
	return nil
}

// SendOfficialAccountAppointmentRemindNotice 公众号-发送预约提醒通知
func (s *UserMessageRepo) SendOfficialAccountAppointmentRemindNotice(ctx context.Context, officialAccountOpenId string, orderId, orderNumber, courseName, appointmentTime string) error {
	_, err := s.data.officialAccountClient.TemplateMessage.Send(ctx, &templateMessage.RequestTemlateMessage{
		ToUser:     officialAccountOpenId,
		TemplateID: s.cfg.OfficialAccount.TemplateId["appointmentReminder"],
		URL:        "",
		MiniProgram: &templateMessage.MiniProgram{
			AppID:    s.cfg.Xcx.AppID,
			PagePath: "/pages/order/appointed/index?orderId=" + orderId,
		},
		Data: &power.HashMap{
			"character_string2": power.StringMap{
				"value": orderNumber, //订单编号
				"color": "#173177",
			},
			"time9": power.StringMap{
				"value": appointmentTime, //预约时间
				"color": "#173177",
			},
			"thing8": power.StringMap{
				"value": courseName, //预约项目
				"color": "#173177",
			},
			"thing10": power.StringMap{
				"value": "请联系客服咨询", //预约地址，暂时写死
				"color": "#173177",
			},
		},
	})
	if err != nil {
		return err
	}
	return nil
}
