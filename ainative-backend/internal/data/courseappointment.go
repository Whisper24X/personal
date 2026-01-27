package data

import (
	"context"
	"fmt"

	"github.com/go-kratos/kratos/v2/log"
	shadowV1 "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/conf"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_dao"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/webhook"
)

var _ biz.CourseAppointmentRepo = (*CourseAppointmentRepo)(nil)

func NewCourseAppointmentRepo(
	logger log.Logger,
	data *Data,
	courseAppointmentRepo *yanxue_repo.CourseAppointmentRepo,
	cfg *conf.Bootstrap,
) biz.CourseAppointmentRepo {
	l := log.NewHelper(log.With(logger, "module", "data/courseAppointment"), log.WithMessageKey("message"))
	return &CourseAppointmentRepo{
		log:                   l,
		data:                  data,
		CourseAppointmentRepo: courseAppointmentRepo,
		cfg:                   cfg,
	}
}

type CourseAppointmentRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.CourseAppointmentRepo
	cfg *conf.Bootstrap
}

// DTOShadowCourseAppointment 转换为 shadowV1.CourseAppointmentInfo
func (r *CourseAppointmentRepo) DTOShadowCourseAppointment(courseAppointment *yanxue_model.CourseAppointment) (*shadowV1.CourseAppointmentInfo, error) {
	studentIdentityCard := ""
	var err error
	if courseAppointment.StudentIC != "" {
		studentIdentityCard, err = cryptutil.YcCardDecrypt(courseAppointment.StudentIC)
		if err != nil {
			return nil, err
		}
	}
	parentPhone, err := cryptutil.YcPhoneDecrypt(courseAppointment.ParentPh)
	if err != nil {
		return nil, err
	}
	return &shadowV1.CourseAppointmentInfo{
		Id:                  courseAppointment.ID,
		OrderId:             courseAppointment.OrderID,
		GoodId:              courseAppointment.GoodID,
		CourseId:            courseAppointment.CourseID,
		Date:                courseAppointment.Date,
		Period:              courseAppointment.Period,
		StudentName:         courseAppointment.StudentName,
		StudentIdentityCard: studentIdentityCard,
		StudentSex:          courseAppointment.StudentSex,
		StudentAge:          int32(courseAppointment.StudentAge),
		ParentName:          courseAppointment.ParentName,
		ParentPhone:         parentPhone,
		ParentAccompany:     courseAppointment.ParentAccompany,
		VerificationCode:    courseAppointment.VerificationCode,
		Status:              courseAppointment.Status,
		CreatedAt:           timeutil.RFC3339(courseAppointment.CreatedAt),
		UpdatedAt:           timeutil.RFC3339(courseAppointment.UpdatedAt),
		UpdatedBy:           courseAppointment.UpdatedBy,
		UpdatedByName:       "",
		GoodName:            "",
		CourseName:          "",
		ContractStatus:      courseAppointment.ContractStatus,
		ParentRemark:        courseAppointment.ParentRemark,
		BusinessRemark:      courseAppointment.BusinessRemark,
	}, nil
}

// DatePeriodToCountByCourseIdDates 日期-时间段-预约人数
func (r *CourseAppointmentRepo) DatePeriodToCountByCourseIdDates(ctx context.Context, courseIds []string, dates []string) (map[string]int32, error) {
	result := make(map[string]int32)
	type Tmp struct {
		CourseID string `gorm:"column:courseId"`
		Date     string `gorm:"column:date"`
		Period   string `gorm:"column:period"`
		Count    int32  `gorm:"column:count"`
	}
	tmp := make([]*Tmp, 0)
	dao := yanxue_dao.Use(r.data.db).CourseAppointment
	err := dao.WithContext(ctx).Select(dao.CourseID, dao.Date, dao.Period, dao.ID.Count().As("count")).Where(dao.CourseID.In(courseIds...), dao.Date.In(dates...), dao.Status.In(constant.CourseAppointmentStatusSuccess.String(), constant.CourseAppointmentStatusCompleted.String())).Group(dao.CourseID, dao.Date, dao.Period).Scan(&tmp)
	if err != nil {
		return nil, err
	}
	for _, v := range tmp {
		result[v.CourseID+v.Date+v.Period] = v.Count
	}
	return result, nil
}

// CreateCourseAppointmentFeiShuNotify 新增预约通知
func (r *CourseAppointmentRepo) CreateCourseAppointmentFeiShuNotify(ctx context.Context, appointmentTopic, appointmentTime, appointmentUserName, appointmentPhone, channelOrderNumber string, appointmentCount int32) error {
	var content = `**新增用户预约，请及时处理。**
**预约主题:** %s
**预约时间：**%s
**预约姓名：**%s
**预约手机号：**%s
**渠道订单编号：**%s
**预约人数：**%d`
	// 发送飞书通知
	feiShuCfg := r.cfg.Yc.FeiShu["createCourseAppointment"]
	card := webhook.Card{
		Elements: []webhook.CardElement{
			{
				Tag: "div",
				Text: webhook.CardElementsText{
					Content: fmt.Sprintf(content, appointmentTopic, appointmentTime, appointmentUserName, appointmentPhone, channelOrderNumber, appointmentCount),
					Tag:     "lark_md",
				},
			},
		},
		Header: webhook.CardHeader{
			Title: webhook.CardHeaderTitle{
				Content: "新增预约通知",
				Tag:     "plain_text",
			},
			Template: "blue",
		},
	}
	err := webhook.NewFeiShu(feiShuCfg.GetUrl(), feiShuCfg.GetSign()).SendCard(card)
	if err != nil {
		return err
	}
	r.log.Infof(fmt.Sprintf("成功发送飞书通知！预约主题:%s,预约时间：%s,预约姓名：%s,预约手机号：%s,渠道订单编号：%s,预约人数：%d", appointmentTopic, appointmentTime, appointmentUserName, appointmentPhone, channelOrderNumber, appointmentCount))
	return nil
}

// CourseAppointmentSituationFeiShuNotify 课程预约情况飞书通知
func (r *CourseAppointmentRepo) CourseAppointmentSituationFeiShuNotify(ctx context.Context, data []*biz.CourseAppointmentSituationFeiShuNotifyReq) error {
	var template = `**主题:** %s
**日期：**%s
**时段：**%s
**预约人数：**%d
`
	var content string
	for _, item := range data {
		content = content + fmt.Sprintf(template, item.AppointmentTopic, item.Date, item.Period, item.AppointmentCount) + "\n"
	}
	if len(data) == 0 {
		content = "暂无预约信息，详情进入预约后台查看"
	}
	// 发送飞书通知
	feiShuCfg := r.cfg.Yc.FeiShu["createCourseAppointment"]
	card := webhook.Card{
		Elements: []webhook.CardElement{
			{
				Tag: "div",
				Text: webhook.CardElementsText{
					Content: content,
					Tag:     "lark_md",
				},
			},
		},
		Header: webhook.CardHeader{
			Title: webhook.CardHeaderTitle{
				Content: "后一周预约情况通知",
				Tag:     "plain_text",
			},
			Template: "blue",
		},
	}
	err := webhook.NewFeiShu(feiShuCfg.GetUrl(), feiShuCfg.GetSign()).SendCard(card)
	if err != nil {
		return err
	}
	return nil
}

// QueryCourseAppointmentsByOrderNumberList 模糊查询订单编号的预约记录
func (r *CourseAppointmentRepo) QueryCourseAppointmentsByOrderNumberList(ctx context.Context, orderNumberList []string) ([]*yanxue_model.CourseAppointment, error) {
	//page := int32(1)
	//pageSize := int32(5000)
	//param := &condition.Req{
	//	Page:     page,
	//	PageSize: pageSize,
	//	Query:    []*condition.QueryParam{},
	//	Order: []*condition.OrderParam{
	//		{
	//			Field: "createdAt",
	//			Order: condition.DESC,
	//		},
	//	},
	//}
	//for _, orderNumber := range orderNumberList {
	//	param.Query = append(param.Query, &condition.QueryParam{
	//		Field: "platformGoodId",
	//		Value: req.GetPlatformGoodId(),
	//		Exp:   condition.EQ,
	//		Logic: condition.AND,
	//	})
	//}
	return []*yanxue_model.CourseAppointment{}, nil
}
