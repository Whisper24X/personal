package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/diagnosis/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewDiagnosisV1DiagnosisService(
	logger log.Logger,
	diagnosisV1DiagnosisUseCase *biz.DiagnosisV1DiagnosisUseCase,
) *DiagnosisV1DiagnosisService {
	l := log.NewHelper(log.With(logger, "module", "service/diagnosisV1Diagnosis"), log.WithMessageKey("message"))
	return &DiagnosisV1DiagnosisService{
		log:                         l,
		diagnosisV1DiagnosisUseCase: diagnosisV1DiagnosisUseCase,
	}
}

type DiagnosisV1DiagnosisService struct {
	pb.UnimplementedDiagnosisServer
	log                         *log.Helper
	diagnosisV1DiagnosisUseCase *biz.DiagnosisV1DiagnosisUseCase
}

// DiagnosisCvsList 可选择教材cvs列表
func (d *DiagnosisV1DiagnosisService) DiagnosisCvsList(ctx context.Context, req *pb.DiagnosisCvsListRequest) (*pb.DiagnosisCvsListReply, error) {
	return d.diagnosisV1DiagnosisUseCase.DiagnosisCvsList(ctx, req)
}

// DiagnosisSchoolYearList 查询当前支持的全部年级
func (d *DiagnosisV1DiagnosisService) DiagnosisSchoolYearList(ctx context.Context, req *pb.DiagnosisSchoolYearListRequest) (*pb.DiagnosisSchoolYearListReply, error) {
	return d.diagnosisV1DiagnosisUseCase.DiagnosisSchoolYearList(ctx, req)
}

// GetTextbookIdsBySchoolYear 根据学科学段年级获取教材信息
func (d *DiagnosisV1DiagnosisService) GetTextbookIdsBySchoolYear(ctx context.Context, req *pb.GetTextbookIdsBySchoolYearRequest) (*pb.GetTextbookIdsBySchoolYearReply, error) {
	return d.diagnosisV1DiagnosisUseCase.GetTextbookIdsBySchoolYear(ctx, req)
}

// UserSelectTextbookReport 用户选择的教材上报
func (d *DiagnosisV1DiagnosisService) UserSelectTextbookReport(ctx context.Context, req *pb.UserSelectTextbookReportRequest) (*pb.ReplyEmpty, error) {
	return d.diagnosisV1DiagnosisUseCase.UserSelectTextbookReport(ctx, req)
}

// GetUserSelectTextbookLast 用户最后一次选择的教材
func (d *DiagnosisV1DiagnosisService) GetUserSelectTextbookLast(ctx context.Context, req *pb.GetUserSelectTextbookLastRequest) (*pb.GetUserSelectTextbookLastReply, error) {
	return d.diagnosisV1DiagnosisUseCase.GetUserSelectTextbookLast(ctx, req)
}

// UserSelectExamRedo 用户所选试卷重做
func (d *DiagnosisV1DiagnosisService) UserSelectExamRedo(ctx context.Context, req *pb.UserSelectExamRedoRequest) (*pb.ReplyEmpty, error) {
	return d.diagnosisV1DiagnosisUseCase.UserSelectExamRedo(ctx, req)
}

// UserSelectExamInfo 根据cvs选项获取当前所选教材试卷信息
func (d *DiagnosisV1DiagnosisService) UserSelectExamInfo(ctx context.Context, req *pb.UserSelectExamInfoRequest) (*pb.UserSelectExamInfoReply, error) {
	return d.diagnosisV1DiagnosisUseCase.UserSelectExamInfo(ctx, req)
}

// UserSelectExamFinishInfo 用户当前所选教材完成情况
func (d *DiagnosisV1DiagnosisService) UserSelectExamFinishInfo(ctx context.Context, req *pb.UserSelectExamFinishInfoRequest) (*pb.UserSelectExamFinishInfoReply, error) {
	return d.diagnosisV1DiagnosisUseCase.UserSelectExamFinishInfo(ctx, req)
}

// UserExamResultReport 用户所选教材对应的试卷结果报告
func (d *DiagnosisV1DiagnosisService) UserExamResultReport(ctx context.Context, req *pb.UserExamResultReportRequest) (*pb.UserExamResultReportReply, error) {
	return d.diagnosisV1DiagnosisUseCase.UserExamResultReport(ctx, req)
}

// UserExamFinishNotice 用户诊疗完成同步
func (d *DiagnosisV1DiagnosisService) UserExamFinishNotice(ctx context.Context, req *pb.UserExamFinishNoticeRequest) (*pb.ReplyEmpty, error) {
	return d.diagnosisV1DiagnosisUseCase.UserExamFinishNotice(ctx, req)
}
