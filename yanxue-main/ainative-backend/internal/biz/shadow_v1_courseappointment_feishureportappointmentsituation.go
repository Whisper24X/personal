package biz

import (
	"context"
	"strings"
	"time"

	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/cache"
	constant1 "gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// FeiShuReportAppointmentSituation 飞书通知预约情况
func (s *ShadowV1CourseAppointmentUseCase) FeiShuReportAppointmentSituation(ctx context.Context, req *pb.FeiShuReportAppointmentSituationReq) (*pb.FeiShuReportAppointmentSituationReply, error) {
	resp := &pb.FeiShuReportAppointmentSituationReply{}
	err := s.commonRepo.LockOnce(ctx, cache.FeiShuReportAppointmentSituationLock.Key(), cache.FeiShuReportAppointmentSituationLock.TTL(), func() error {
		param := &condition.Req{
			Query: []*condition.QueryParam{},
			Order: []*condition.OrderParam{
				{
					Field: "updatedAt",
					Order: condition.DESC,
				},
			},
		}

		now := time.Now().Format("2006-01-02")
		afterOneWeek := time.Now().AddDate(0, 0, 6).Format("2006-01-02")

		param.Query = append(param.Query, &condition.QueryParam{
			Field: "date",
			Value: now,
			Exp:   condition.GTE,
			Logic: condition.AND,
		})

		param.Query = append(param.Query, &condition.QueryParam{
			Field: "date",
			Value: afterOneWeek,
			Exp:   condition.LTE,
			Logic: condition.AND,
		})

		courseAppointmentList, _, err := s.courseAppointmentRepo.FindMultiByCondition(ctx, param)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}

		appointmentCountMap := make(map[string]int32)
		var courseIdList []string
		for _, appointment := range courseAppointmentList {
			courseIdList = append(courseIdList, appointment.CourseID)
		}
		courseIdList = lo.Uniq(courseIdList)

		if len(courseIdList) == 0 {
			return nil
		}
		courseList, err := s.courseRepo.FindMultiByIDS(ctx, courseIdList)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
		courseIdToNameMap := make(map[string]string)
		for _, course := range courseList {
			courseIdToNameMap[course.ID] = course.CourseName
		}
		for _, appointment := range courseAppointmentList {
			if appointment.Status == constant1.CourseAppointmentStatusCancel.String() {
				continue
			}
			courseName := courseIdToNameMap[appointment.CourseID]
			appointmentCountMap[courseName+"||"+appointment.Date+"||"+appointment.Period]++
		}

		var notifyData []*CourseAppointmentSituationFeiShuNotifyReq
		for key, count := range appointmentCountMap {
			splitList := strings.Split(key, "||")
			if len(splitList) != 3 {
				continue
			}
			courseName := splitList[0]
			date := splitList[1]
			period := splitList[2]
			notifyData = append(notifyData, &CourseAppointmentSituationFeiShuNotifyReq{
				AppointmentTopic: courseName,
				Date:             date,
				Period:           period,
				AppointmentCount: count,
			})
		}
		s.courseAppointmentRepo.CourseAppointmentSituationFeiShuNotify(ctx, notifyData)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return resp, nil
}
