package biz

import (
	"context"

	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// GetCourseList 课程-信息-列表数据查询
func (s *ShadowV1CourseUseCase) GetCourseList(ctx context.Context, req *pb.GetCourseListReq) (*pb.GetCourseListReply, error) {
	resp := &pb.GetCourseListReply{
		Total: 0,
		List:  []*pb.CourseInfo{},
	}
	param := &condition.Req{
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "updatedAt",
				Order: condition.DESC,
			},
		},
	}
	if req.GetCourseName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "courseName",
			Value: "%" + req.GetCourseName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	if req.GetStatus() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "status",
			Value: req.GetStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	if req.GetCourseType() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "courseType",
			Value: req.GetCourseType(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	courseList, p, err := s.courseRepo.FindMultiCacheByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = p.Total
	if len(courseList) > 0 {
		adminIds := lo.Map(courseList, func(item *yanxue_model.Course, _ int) string {
			return item.UpdatedBy
		})
		adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, adminIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		for _, course := range courseList {
			courseInfo, err := s.courseRepo.DTOShadowCourse(course)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
			courseInfo.UpdatedByName = adminMap[course.UpdatedBy]
			resp.List = append(resp.List, courseInfo)
		}
	}
	return resp, nil
}
