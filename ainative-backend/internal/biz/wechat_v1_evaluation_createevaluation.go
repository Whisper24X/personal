package biz

import (
	"context"
	"fmt"
	"net/http"

	"github.com/go-kratos/kratos/v2/errors"
	pb "gitlab.yc345.tv/backend/yanxue/api/wechat/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// CreateEvaluation 评价表-创建一条数据
func (w *WechatV1EvaluationUseCase) CreateEvaluation(ctx context.Context, req *pb.CreateEvaluationReq) (*pb.CreateEvaluationReply, error) {
	resp := &pb.CreateEvaluationReply{}

	ph, err := cryptutil.YcPhoneEncrypt(req.Phone)
	if err != nil {
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("手机号%s格式错误！", req.Phone))
	}
	dimensionScore, err := jsonutil.Marshal(req.DimensionScore)
	if err != nil {
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("维度评分格式错误！"))
	}
	feedBackImage, err := jsonutil.Marshal(req.FeedBackImage)
	if err != nil {
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("反馈图片格式错误！"))
	}
	evaluationLabel, err := jsonutil.Marshal(req.EvaluationLabel)
	if err != nil {
		return resp, errors.New(http.StatusBadRequest, "-1", fmt.Sprintf("评价标签格式错误！"))
	}
	evaluationTemplate := &yanxue_model.Evaluation{
		AppointmentID:   req.AppointmentId,
		ParentName:      req.ParentName,
		Ph:              ph,
		ChildName:       req.ChildName,
		CourseName:      req.CourseName,
		CourseTime:      req.CourseTime,
		TotalScore:      req.TotalScore,
		DimensionScore:  dimensionScore,
		FeedBack:        req.FeedBack,
		FeedBackImage:   feedBackImage,
		EvaluationLabel: evaluationLabel,
	}
	err = w.evaluationRepo.CreateOneCache(ctx, evaluationTemplate)
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Id = evaluationTemplate.ID
	return resp, nil
}
