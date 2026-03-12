package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
)

// GetCourseInfo 课程-信息-单条数据查询
func (s *ShadowV1CourseUseCase) GetCourseInfo(ctx context.Context, req *pb.GetCourseInfoReq) (*pb.GetCourseInfoReply, error) {
	resp := &pb.GetCourseInfoReply{}
	course, err := s.courseRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseInfo, err := s.courseRepo.DTOShadowCourse(course)
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	adminMap, err := s.sysAdminRepo.AdminIdToName(ctx, []string{course.UpdatedBy})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseInfo.UpdatedByName = adminMap[course.UpdatedBy]
	resp.Info = courseInfo
	return resp, nil
}
