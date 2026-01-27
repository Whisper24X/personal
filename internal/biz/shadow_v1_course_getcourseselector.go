package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// GetCourseSelector 课程-信息-选择器
func (s *ShadowV1CourseUseCase) GetCourseSelector(ctx context.Context, req *pb.GetCourseSelectorReq) (*pb.GetCourseSelectorReply, error) {
	resp := &pb.GetCourseSelectorReply{
		List: []*pb.CourseSelector{},
	}
	if req.GetCourseType() != "" && req.GetCourseType() != string(constant.CourseTypeSingle) &&
		req.GetCourseType() != string(constant.CourseTypeMulti) {
		return resp, errors.New(http.StatusBadRequest, "-1", "课程类型错误！")
	}
	param := &condition.Req{
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
	if req.GetCourseType() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "courseType",
			Value: req.GetCourseType(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	courseList, _, err := s.courseRepo.FindMultiCacheByCondition(ctx, param)
	if err != nil {
		return nil, err
	}
	resp.List = lo.Map(courseList, func(course *yanxue_model.Course, _ int) *pb.CourseSelector {
		return &pb.CourseSelector{
			Id:         course.ID,
			CourseName: course.CourseName,
			CourseType: course.CourseType,
		}
	})
	return resp, nil
}
