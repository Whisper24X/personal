package data

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/samber/lo"

	shadowV1 "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.CourseRepo = (*CourseRepo)(nil)

func NewCourseRepo(
	logger log.Logger,
	data *Data,
	courseRepo *yanxue_repo.CourseRepo,
) biz.CourseRepo {
	l := log.NewHelper(log.With(logger, "module", "data/course"), log.WithMessageKey("message"))
	return &CourseRepo{
		log:        l,
		data:       data,
		CourseRepo: courseRepo,
	}
}

type CourseRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.CourseRepo
}

// DTOShadowCourse 课程-信息-DTO
func (r *CourseRepo) DTOShadowCourse(course *yanxue_model.Course) (*shadowV1.CourseInfo, error) {
	mainImage := make([]string, 0)
	err := jsonutil.Unmarshal(course.MainImage, &mainImage)
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	detailImages := make([]string, 0)
	err = jsonutil.Unmarshal(course.DetailImages, &detailImages)
	if err != nil {
		return nil, errorx.DataFormattingError.WithError(err).Err()
	}
	return &shadowV1.CourseInfo{
		Id:                     course.ID,
		CourseName:             course.CourseName,
		MainImage:              mainImage,
		DetailImages:           detailImages,
		Price:                  int32(course.Price * 100), // 数据库存储的是元，转换为分返回给前端
		Status:                 course.Status,
		IsPushContractRequired: course.IsPushContractRequired,
		CreatedAt:              timeutil.RFC3339(course.CreatedAt),
		UpdatedAt:              timeutil.RFC3339(course.UpdatedAt),
		CourseType:             course.CourseType,
		UpdatedBy:              course.UpdatedBy,
	}, nil
}

// CourseIdToName 课程Id转名称
func (r *CourseRepo) CourseIdToName(ctx context.Context, courseIds []string) (map[string]string, error) {
	courseIds = lo.Uniq(courseIds)
	courseIds = lo.Filter(courseIds, func(item string, _ int) bool {
		return item != ""
	})
	if len(courseIds) == 0 {
		return map[string]string{}, nil
	}
	list, err := r.FindMultiCacheByIDS(ctx, courseIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	courseNameMap := make(map[string]string)
	for _, course := range list {
		courseNameMap[course.ID] = course.CourseName
	}
	return courseNameMap, nil
}

// CourseIdToIsPushContractRequired 课程Id转是否需要推送合同
func (r *CourseRepo) CourseIdToIsPushContractRequired(ctx context.Context, courseIds []string) (map[string]bool, error) {
	courseIds = lo.Uniq(courseIds)
	courseIds = lo.Filter(courseIds, func(item string, _ int) bool {
		return item != ""
	})
	if len(courseIds) == 0 {
		return map[string]bool{}, nil
	}
	list, err := r.FindMultiCacheByIDS(ctx, courseIds)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	isPushContractRequiredMap := make(map[string]bool)
	for _, course := range list {
		isPushContractRequiredMap[course.ID] = course.IsPushContractRequired
	}
	return isPushContractRequiredMap, nil
}
