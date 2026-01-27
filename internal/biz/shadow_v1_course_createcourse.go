package biz

import (
	"context"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// CreateCourse 课程-信息-创建一条数据
func (s *ShadowV1CourseUseCase) CreateCourse(ctx context.Context, req *pb.CreateCourseReq) (*pb.CreateCourseReply, error) {
	resp := &pb.CreateCourseReply{
		Id: "",
	}
	adminId := meta.GetAdminID(ctx)
	mainImage, err := jsonutil.Marshal(req.GetMainImage())
	if err != nil {
		return nil, errorx.DataFormattingError.Err()
	}
	detailImages, err := jsonutil.Marshal(req.GetDetailImages())
	if err != nil {
		return nil, errorx.DataFormattingError.Err()
	}
	// 校验课程类型
	if req.GetCourseType() != string(constant.CourseTypeSingle) &&
		req.GetCourseType() != string(constant.CourseTypeMulti) {
		return nil, errors.New(http.StatusBadRequest, "-1", "课程类型错误！")
	}
	course := &yanxue_model.Course{
		CourseName:             req.GetCourseName(),
		MainImage:              mainImage,
		DetailImages:           detailImages,
		Price:                  float32(req.GetPrice()) / 100.0, // 前端传入分，转换为元存储
		Status:                 constant.CourseStatusPutOff.String(),
		CourseType:             req.GetCourseType(),
		IsPushContractRequired: req.GetIsPushContractRequired(),
		UpdatedBy:              adminId,
	}
	err = s.courseRepo.CreateOneCache(ctx, course)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Id = course.ID
	return resp, nil
}
