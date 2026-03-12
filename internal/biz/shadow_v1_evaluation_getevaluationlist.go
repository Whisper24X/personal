package biz

import (
	"context"
	"net/http"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
)

// GetEvaluationList 评价表-列表数据查询
func (s *ShadowV1EvaluationUseCase) GetEvaluationList(ctx context.Context, req *pb.GetEvaluationListReq) (*pb.GetEvaluationListReply, error) {
	resp := &pb.GetEvaluationListReply{}
	page := int32(1)
	pageSize := int32(100)
	if req.GetPage() != 0 {
		page = req.GetPage()
	}
	if req.GetPageSize() != 0 {
		pageSize = req.GetPageSize()
	}
	param := &condition.Req{
		Page:     page,
		PageSize: pageSize,
		Query:    []*condition.QueryParam{},
		Order: []*condition.OrderParam{
			{
				Field: "updatedAt",
				Order: condition.DESC,
			},
		},
	}
	if req.GetStartTime() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "createdAt",
			Value: req.GetStartTime(),
			Exp:   condition.GTE,
			Logic: condition.AND,
		})
	}
	if req.GetEndTime() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "createdAt",
			Value: req.GetEndTime(),
			Exp:   condition.LTE,
			Logic: condition.AND,
		})
	}
	if req.GetPhone() != "" {
		ph, err := cryptutil.YcPhoneEncrypt(req.Phone)
		if err != nil {
			return resp, errors.New(http.StatusBadRequest, "-1", "手机号格式错误")
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "ph",
			Value: ph,
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}

	if req.GetParentName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "parentName",
			Value: "%" + req.GetParentName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	if req.GetChildName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "childName",
			Value: "%" + req.GetChildName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	if req.GetCourseName() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "courseName",
			Value: "%" + req.GetCourseName() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}

	list, pageInfo, err := s.evaluationRepo.FindMultiCacheByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = pageInfo.Total
	for _, evaluation := range list {
		var dimensionScore []string
		err = jsonutil.Unmarshal(evaluation.DimensionScore, &dimensionScore)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		var feedBackImage []string
		err = jsonutil.Unmarshal(evaluation.FeedBackImage, &feedBackImage)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		var evaluationLabel []string
		err = jsonutil.Unmarshal(evaluation.EvaluationLabel, &evaluationLabel)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		phone, err := cryptutil.YcPhoneDecrypt(evaluation.Ph)
		if err != nil {
			return resp, errorx.DataFormattingError.WithError(err).Err()
		}
		resp.List = append(resp.List, &pb.EvaluationInfo{
			Id:              evaluation.ID,
			AppointmentId:   evaluation.AppointmentID,
			ParentName:      evaluation.ParentName,
			Phone:           phone,
			ChildName:       evaluation.ChildName,
			CourseName:      evaluation.CourseName,
			CourseTime:      evaluation.CourseTime,
			TotalScore:      evaluation.TotalScore,
			DimensionScore:  dimensionScore,
			FeedBack:        evaluation.FeedBack,
			FeedBackImage:   feedBackImage,
			EvaluationLabel: evaluationLabel,
			CreatedAt:       evaluation.CreatedAt.Format(time.RFC3339),
			UpdatedAt:       evaluation.UpdatedAt.Format(time.RFC3339),
		})
	}
	return resp, nil
}
