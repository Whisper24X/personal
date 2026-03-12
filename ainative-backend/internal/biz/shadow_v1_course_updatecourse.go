package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// UpdateCourse 课程-信息-更新一条数据
func (s *ShadowV1CourseUseCase) UpdateCourse(ctx context.Context, req *pb.UpdateCourseReq) (*pb.UpdateCourseReply, error) {
	resp := &pb.UpdateCourseReply{}
	adminId := meta.GetAdminID(ctx)
	course, err := s.courseRepo.FindOneCacheByID(ctx, req.GetId())
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	if course == nil || course.ID == "" {
		return nil, errorx.DataRecordNotFound.Err()
	}
	oldCourse := s.courseRepo.DeepCopy(course)
	mainImage, err := jsonutil.Marshal(req.GetMainImage())
	if err != nil {
		return nil, errorx.DataFormattingError.Err()
	}
	detailImages, err := jsonutil.Marshal(req.GetDetailImages())
	if err != nil {
		return nil, errorx.DataFormattingError.Err()
	}
	course.CourseName = req.GetCourseName()
	course.Price = float32(req.GetPrice()) / 100.0 // 前端传入分，转换为元存储
	course.MainImage = mainImage
	course.DetailImages = detailImages
	course.IsPushContractRequired = req.GetIsPushContractRequired()
	course.UpdatedBy = adminId
	err = s.courseRepo.UpdateOneCacheWithZero(ctx, course, oldCourse)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
