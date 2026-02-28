package biz

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// SendAppointmentReminderSmsReply 发送预约提醒短信响应
type SendAppointmentReminderSmsReply struct {
	TomorrowCount        int32
	TomorrowSuccessCount int32
	TomorrowFailCount    int32
	NextWeekCount        int32
	NextWeekSuccessCount int32
	NextWeekFailCount    int32
}

// SendAppointmentReminderSms 发送预约提醒短信
// 每天18点执行，发送明天和下周今天的预约提醒
func (s *ShadowV1CourseAppointmentUseCase) SendAppointmentReminderSms(ctx context.Context) (*SendAppointmentReminderSmsReply, error) {
	resp := &SendAppointmentReminderSmsReply{}

	err := s.commonRepo.LockOnce(ctx, cache.SendAppointmentReminderSmsLock.Key(), cache.SendAppointmentReminderSmsLock.TTL(), func() error {
		now := timeutil.NowCarbon()

		// 明天的日期
		tomorrow := now.AddDays(1).ToDateString()
		// 下周今天的日期（7天后）
		nextWeek := now.AddDays(7).ToDateString()

		s.log.Infof("SendAppointmentReminderSms: 开始发送预约提醒短信, tomorrow=%s, nextWeek=%s", tomorrow, nextWeek)

		// 1. 查询明天的预约
		tomorrowAppointments, err := s.queryAppointmentsByDate(ctx, tomorrow)
		if err != nil {
			s.log.Errorf("SendAppointmentReminderSms: 查询明天的预约失败, err=%v", err)
			return err
		}

		// 2. 查询下周今天的预约
		nextWeekAppointments, err := s.queryAppointmentsByDate(ctx, nextWeek)
		if err != nil {
			s.log.Errorf("SendAppointmentReminderSms: 查询下周的预约失败, err=%v", err)
			return err
		}

		// 根据环境选择短信模版
		var tomorrowTemplateName, tomorrowTemplateID string
		var nextWeekTemplateName, nextWeekTemplateID string

		env := os.Getenv("GO_ENV")
		if env == "test" || env == "stage" {
			// 测试和预发环境使用测试模版
			tomorrowTemplateName = constant.SmsTemplateTomorrowReminderTest
			tomorrowTemplateID = constant.SmsTemplateTomorrowReminderTestID
			nextWeekTemplateName = constant.SmsTemplateNextWeekReminderTest
			nextWeekTemplateID = constant.SmsTemplateNextWeekReminderTestID
			s.log.Infof("SendAppointmentReminderSms: 使用测试环境短信模版, env=%s", env)
		} else {
			// 生产环境使用正式模版
			tomorrowTemplateName = constant.SmsTemplateTomorrowReminder
			tomorrowTemplateID = constant.SmsTemplateTomorrowReminderID
			nextWeekTemplateName = constant.SmsTemplateNextWeekReminder
			nextWeekTemplateID = constant.SmsTemplateNextWeekReminderID
			s.log.Infof("SendAppointmentReminderSms: 使用生产环境短信模版, env=%s", env)
		}

		// 3. 发送明天的预约提醒短信
		tomorrowSuccess, tomorrowFail := s.sendReminderSms(ctx, tomorrowAppointments, tomorrowTemplateName, tomorrowTemplateID)

		// 4. 发送下周的预约提醒短信
		nextWeekSuccess, nextWeekFail := s.sendReminderSms(ctx, nextWeekAppointments, nextWeekTemplateName, nextWeekTemplateID)

		resp.TomorrowCount = int32(len(tomorrowAppointments))
		resp.TomorrowSuccessCount = tomorrowSuccess
		resp.TomorrowFailCount = tomorrowFail
		resp.NextWeekCount = int32(len(nextWeekAppointments))
		resp.NextWeekSuccessCount = nextWeekSuccess
		resp.NextWeekFailCount = nextWeekFail

		s.log.Infof("SendAppointmentReminderSms: 发送完成, 明天预约数=%d, 成功=%d, 失败=%d, 下周预约数=%d, 成功=%d, 失败=%d",
			resp.TomorrowCount, resp.TomorrowSuccessCount, resp.TomorrowFailCount,
			resp.NextWeekCount, resp.NextWeekSuccessCount, resp.NextWeekFailCount)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// queryAppointmentsByDate 查询指定日期的已预约记录
func (s *ShadowV1CourseAppointmentUseCase) queryAppointmentsByDate(ctx context.Context, date string) ([]*yanxue_model.CourseAppointment, error) {
	// 查询指定日期的预约记录
	// 支持两种日期格式：
	// 1. 单日期："2026-02-05"
	// 2. 日期范围："2026-02-05到2026-02-10"（匹配起始日期）

	// 先查询日期完全匹配的
	appointments1, _, err := s.courseAppointmentRepo.FindMultiByCondition(ctx, &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "date",
				Value: date,
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
			{
				Field: "status",
				Value: constant.CourseAppointmentStatusSuccess.String(), // 已预约
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
		},
	})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 再查询日期范围的（date字段包含"到"的情况）
	// 例如：date = "2026-02-05到2026-02-10"，如果目标日期是 "2026-02-05"，则匹配
	allAppointments, _, err := s.courseAppointmentRepo.FindMultiByCondition(ctx, &condition.Req{
		Query: []*condition.QueryParam{
			{
				Field: "status",
				Value: constant.CourseAppointmentStatusSuccess.String(), // 已预约
				Exp:   condition.EQ,
				Logic: condition.AND,
			},
		},
	})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}

	// 过滤出日期范围包含目标日期的预约
	appointments2 := make([]*yanxue_model.CourseAppointment, 0)
	for _, appt := range allAppointments {
		if strings.Contains(appt.Date, "到") {
			// 提取起始日期
			parts := strings.Split(appt.Date, "到")
			if len(parts) >= 2 {
				startDate := strings.TrimSpace(parts[0])
				if startDate == date {
					appointments2 = append(appointments2, appt)
				}
			}
		}
	}

	// 合并结果并去重
	appointmentMap := make(map[string]*yanxue_model.CourseAppointment)
	for _, appt := range appointments1 {
		appointmentMap[appt.ID] = appt
	}
	for _, appt := range appointments2 {
		appointmentMap[appt.ID] = appt
	}

	result := make([]*yanxue_model.CourseAppointment, 0, len(appointmentMap))
	for _, appt := range appointmentMap {
		result = append(result, appt)
	}

	s.log.Infof("queryAppointmentsByDate: date=%s, count=%d", date, len(result))
	return result, nil
}

// sendReminderSms 批量发送提醒短信
// 返回成功数和失败数
func (s *ShadowV1CourseAppointmentUseCase) sendReminderSms(ctx context.Context, appointments []*yanxue_model.CourseAppointment, templateName, templateID string) (int32, int32) {
	var successCount int32 = 0
	var failCount int32 = 0

	for _, appt := range appointments {
		// 解密家长手机号
		phone, err := cryptutil.YcPhoneDecrypt(appt.ParentPh)
		if err != nil {
			s.log.Errorf("SendAppointmentReminderSms: 解密手机号失败, appointmentId=%s, err=%v", appt.ID, err)
			failCount++
			continue
		}

		// 查询课程信息获取课程名称
		course, err := s.courseRepo.FindOneCacheByID(ctx, appt.CourseID)
		if err != nil {
			s.log.Errorf("SendAppointmentReminderSms: 查询课程失败, appointmentId=%s, courseId=%s, err=%v", appt.ID, appt.CourseID, err)
			failCount++
			continue
		}
		if course == nil || course.ID == "" {
			s.log.Errorf("SendAppointmentReminderSms: 课程不存在, appointmentId=%s, courseId=%s", appt.ID, appt.CourseID)
			failCount++
			continue
		}

		// 构造短信参数
		// 提取日期和时间段
		date := appt.Date
		period := appt.Period

		// 如果是日期范围，只取起始日期
		if strings.Contains(date, "到") {
			parts := strings.Split(date, "到")
			if len(parts) >= 2 {
				date = strings.TrimSpace(parts[0])
			}
		}

		// 格式化课程时间: "2026年2月5日 15:30"
		courseTime := formatCourseTimeForSms(date, period)

		// 发送短信
		err = s.smsNotifyHttpRpc.SendSms(ctx, &rpc.SendSmsReq{
			Phone:       []string{phone},
			Template:    templateName,
			FromService: "yanxue",
			Params: map[string]string{
				"classname": course.CourseName, // 课程名称
				"time":      courseTime,        // 课程时间: "2026年2月5日 15:30"
			},
		})

		if err != nil {
			s.log.Errorf("SendAppointmentReminderSms: 发送短信失败, appointmentId=%s, phone=%s, template=%s, courseName=%s, time=%s, err=%v",
				appt.ID, phone, templateName, course.CourseName, courseTime, err)
			failCount++
		} else {
			s.log.Infof("SendAppointmentReminderSms: 发送短信成功, appointmentId=%s, phone=%s, template=%s, courseName=%s, time=%s",
				appt.ID, phone, templateName, course.CourseName, courseTime)
			successCount++
		}
	}

	return successCount, failCount
}

// formatCourseTimeForSms 格式化课程时间为短信格式
// 输入: date="2026-02-05", period="15:30-17:00"
// 输出: "2026年2月5日 15:30"
func formatCourseTimeForSms(dateStr, period string) string {
	// 尝试解析日期
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		// 如果解析失败，返回原始字符串
		if period != "" {
			return dateStr + " " + period
		}
		return dateStr
	}

	// 提取开始时间
	startTime := ""
	if period != "" {
		parts := strings.Split(period, "-")
		if len(parts) >= 1 {
			startTime = strings.TrimSpace(parts[0])
		}
	}

	// 格式化为 "2026年2月5日 15:30"
	if startTime != "" {
		return fmt.Sprintf("%d年%d月%d日 %s", t.Year(), t.Month(), t.Day(), startTime)
	}

	// 如果没有时间段，只返回日期
	return fmt.Sprintf("%d年%d月%d日", t.Year(), t.Month(), t.Day())
}
