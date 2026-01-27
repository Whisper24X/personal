package biz

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v2/errors"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	ctxn "gitlab.yc345.tv/backend/yanxue/internal/pkg/middleware/ctx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/jsonutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

// ExportEvaluationList 评价表-导出评价列表
func (s *ShadowV1EvaluationUseCase) ExportEvaluationList(ctx context.Context, req *pb.ExportEvaluationListReq) (*pb.ExportEvaluationListReply, error) {
	resp := &pb.ExportEvaluationListReply{}
	key := cryptutil.Sha256(req.String())
	filePath := fmt.Sprintf("./tmp/evaluation_export_%s.csv", key)
	neverDoneCtx := ctxn.NewNeverDoneCtx(ctx)
	downloadUrl, err := s.bffRepo.QueryAndUploadCSV(neverDoneCtx, key, filePath, func() ([][]string, error) {
		param := &condition.Req{
			Query: []*condition.QueryParam{},
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
				return nil, errors.New(http.StatusBadRequest, "-1", "手机号格式错误")
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
		list, _, err := s.evaluationRepo.FindMultiCacheByCondition(neverDoneCtx, param)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		if len(list) == 0 {
			return nil, nil
		}
		csvData := make([][]string, 0)
		csvData = append(csvData, []string{
			"预约编号",
			"家长姓名",
			"联系方式",
			"孩子姓名",
			"课程名称",
			"上课时间",
			"总评分",
			"维度评分",
			"反馈内容",
			"反馈图片",
			"快速标签",
			"反馈时间",
		})
		for _, evaluation := range list {
			var dimensionScore []string
			err = jsonutil.Unmarshal(evaluation.DimensionScore, &dimensionScore)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
			var feedBackImage []string
			err = jsonutil.Unmarshal(evaluation.FeedBackImage, &feedBackImage)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
			var evaluationLabel []string
			err = jsonutil.Unmarshal(evaluation.EvaluationLabel, &evaluationLabel)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
			phone, err := cryptutil.YcPhoneDecrypt(evaluation.Ph)
			if err != nil {
				return nil, errorx.DataFormattingError.WithError(err).Err()
			}
			totalScore := strconv.Itoa(int(evaluation.TotalScore))
			csvData = append(csvData, []string{
				evaluation.AppointmentID,
				evaluation.ParentName,
				phone,
				evaluation.ChildName,
				evaluation.CourseName,
				evaluation.CourseTime,
				totalScore,
				strings.Join(dimensionScore, "\n"),
				evaluation.FeedBack,
				strings.Join(feedBackImage, "\n"),
				strings.Join(evaluationLabel, "\n"),
				timeutil.Carbon().Parse(evaluation.CreatedAt.Format(time.RFC3339)).ToDateTimeString(),
			})
		}
		return csvData, nil
	})
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.DownloadUrl = downloadUrl
	return resp, nil
}
