package data

import (
	"github.com/go-kratos/kratos/v2/log"
	shadowV1 "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.CourseStockRepo = (*CourseStockRepo)(nil)

func NewCourseStockRepo(
	logger log.Logger,
	data *Data,
	courseStockRepo *yanxue_repo.CourseStockRepo,
) biz.CourseStockRepo {
	l := log.NewHelper(log.With(logger, "module", "data/courseStock"), log.WithMessageKey("message"))
	return &CourseStockRepo{
		log:             l,
		data:            data,
		CourseStockRepo: courseStockRepo,
	}
}

type CourseStockRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.CourseStockRepo
}

func (r *CourseStockRepo) DTOShadowCourseStock(courseStock *yanxue_model.CourseStock) (*shadowV1.CourseStockInfo, error) {
	return &shadowV1.CourseStockInfo{
		Id:          courseStock.ID,
		CourseId:    courseStock.CourseID,
		Date:        courseStock.Date,
		Period:      courseStock.Period,
		Stock:       courseStock.Stock,
		Status:      courseStock.Status,
		CreatedAt:   timeutil.RFC3339(courseStock.CreatedAt),
		UpdatedAt:   timeutil.RFC3339(courseStock.UpdatedAt),
		UpdatedBy:   courseStock.UpdatedBy,
		GroupQrCode: courseStock.GroupQrCode,
	}, nil
}
