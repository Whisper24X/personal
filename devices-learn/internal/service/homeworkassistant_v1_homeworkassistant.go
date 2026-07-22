package service

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
	pb "gitlab.yc345.tv/backend/devices-learn/api/homework_assistant/v1"
	"gitlab.yc345.tv/backend/devices-learn/internal/biz"
)

func NewHomeworkAssistantV1HomeworkAssistantService(
	logger log.Logger,
	homeworkAssistantV1HomeworkAssistantUseCase *biz.HomeworkAssistantV1HomeworkAssistantUseCase,
) *HomeworkAssistantV1HomeworkAssistantService {
	l := log.NewHelper(log.With(logger, "module", "service/homeworkAssistantV1HomeworkAssistant"), log.WithMessageKey("message"))
	return &HomeworkAssistantV1HomeworkAssistantService{
		log: l,
		homeworkAssistantV1HomeworkAssistantUseCase: homeworkAssistantV1HomeworkAssistantUseCase,
	}
}

type HomeworkAssistantV1HomeworkAssistantService struct {
	pb.UnimplementedHomeworkAssistantServer
	log                                         *log.Helper
	homeworkAssistantV1HomeworkAssistantUseCase *biz.HomeworkAssistantV1HomeworkAssistantUseCase
}

// BatchSearchQuestionAsync 异步批量搜题
func (h *HomeworkAssistantV1HomeworkAssistantService) BatchSearchQuestionAsync(ctx context.Context, req *pb.BatchSearchQuestionRequest) (*pb.BatchSearchQuestionReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.BatchSearchQuestionAsync(ctx, req)
}

// SearchQuestion 搜题
func (h *HomeworkAssistantV1HomeworkAssistantService) SearchQuestion(ctx context.Context, req *pb.SearchQuestionRequest) (*pb.SearchQuestionReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.SearchQuestion(ctx, req)
}

// QuerySearchResultById 查询搜题结果
func (h *HomeworkAssistantV1HomeworkAssistantService) QuerySearchResultById(ctx context.Context, req *pb.QuerySearchResultByIdRequest) (*pb.QuerySearchResultByIdReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QuerySearchResultById(ctx, req)
}

// QuerySearchRecordList 查询搜题记录列表
func (h *HomeworkAssistantV1HomeworkAssistantService) QuerySearchRecordList(ctx context.Context, req *pb.QuerySearchRecordListRequest) (*pb.QuerySearchRecordListReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QuerySearchRecordList(ctx, req)
}

// RegisterSearchDevices 注册设备
func (h *HomeworkAssistantV1HomeworkAssistantService) RegisterSearchDevices(ctx context.Context, req *pb.RegisterSearchDevicesRequest) (*pb.RegisterSearchDevicesReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.RegisterSearchDevices(ctx, req)
}

// HomeworkFullPageCorrection 作业批改(压测）
func (h *HomeworkAssistantV1HomeworkAssistantService) HomeworkFullPageCorrection(ctx context.Context, req *pb.FullPageCorrectionRequest) (*pb.FullPageCorrectionReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.HomeworkFullPageCorrection(ctx, req)
}

// QueryHomeworkFullPageCorrectionDetailById 作业批改结果查询（压测）
func (h *HomeworkAssistantV1HomeworkAssistantService) QueryHomeworkFullPageCorrectionDetailById(ctx context.Context, req *pb.FullPageCorrectionDetailRequest) (*pb.FullPageCorrectionDetailReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QueryHomeworkFullPageCorrectionDetailById(ctx, req)
}

// UpdateQuestionCorrectionResult 题目批改结果修改
func (h *HomeworkAssistantV1HomeworkAssistantService) UpdateQuestionCorrectionResult(ctx context.Context, req *pb.CorrectionResultRequest) (*pb.CorrectionResultReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.UpdateQuestionCorrectionResult(ctx, req)
}

// QueryCorrectionRecordList 查询批改记录列表（压测）
func (h *HomeworkAssistantV1HomeworkAssistantService) QueryCorrectionRecordList(ctx context.Context, req *pb.QueryCorrectionRecordListRequest) (*pb.QueryCorrectionRecordListReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QueryCorrectionRecordList(ctx, req)
}

// QueryRecommendTopicsSearch 查询知识点名称推荐视频
func (h *HomeworkAssistantV1HomeworkAssistantService) QueryRecommendTopicsSearch(ctx context.Context, req *pb.TopicSearchRequest) (*pb.TopicSearchReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QueryRecommendTopicsSearch(ctx, req)
}

// QueryHomeworkTaskWrongQuestionCount 查询作业任务所属错题数量
func (h *HomeworkAssistantV1HomeworkAssistantService) QueryHomeworkTaskWrongQuestionCount(ctx context.Context, req *pb.QueryHomeworkTaskWrongQuestionCountRequest) (*pb.QueryHomeworkTaskWrongQuestionCountReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QueryHomeworkTaskWrongQuestionCount(ctx, req)
}

// StoreWrongQuestionRectificationInfo 保存错题订正记录
func (h *HomeworkAssistantV1HomeworkAssistantService) StoreWrongQuestionRectificationInfo(ctx context.Context, req *pb.RectificationRequest) (*pb.RectificationReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.StoreWrongQuestionRectificationInfo(ctx, req)
}

// QueryHomeworkTaskWrongQuestionRectificationInfo 查询订正记录详情（压测）
func (h *HomeworkAssistantV1HomeworkAssistantService) QueryHomeworkTaskWrongQuestionRectificationInfo(ctx context.Context, req *pb.RectificationInfoRequest) (*pb.RectificationInfoReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QueryHomeworkTaskWrongQuestionRectificationInfo(ctx, req)
}

// QueryHomeworkAssistantReport 查询作业助手报告
func (h *HomeworkAssistantV1HomeworkAssistantService) QueryHomeworkAssistantReport(ctx context.Context, req *pb.QueryHomeworkAssistantReportRequest) (*pb.QueryHomeworkAssistantReportReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QueryHomeworkAssistantReport(ctx, req)
}

// StoreHomeworkAssistantTaskScore 作业助手积分-任务完成
func (h *HomeworkAssistantV1HomeworkAssistantService) StoreHomeworkAssistantTaskScore(ctx context.Context, req *pb.StoreHomeworkAssistantTaskScoreRequest) (*pb.StoreHomeworkAssistantTaskScoreReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.StoreHomeworkAssistantTaskScore(ctx, req)
}

// StoreHomeworkAssistantRectificationScore 作业助手积分-订正
func (h *HomeworkAssistantV1HomeworkAssistantService) StoreHomeworkAssistantRectificationScore(ctx context.Context, req *pb.StoreHomeworkAssistantRectificationScoreRequest) (*pb.StoreHomeworkAssistantRectificationScoreReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.StoreHomeworkAssistantRectificationScore(ctx, req)
}

// QueryHomeworkAssistantScoreRankList 作业助手排行榜-查询排行榜信息
func (h *HomeworkAssistantV1HomeworkAssistantService) QueryHomeworkAssistantScoreRankList(ctx context.Context, req *pb.QueryHomeworkAssistantScoreRankListRequest) (*pb.QueryHomeworkAssistantScoreRankListReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.QueryHomeworkAssistantScoreRankList(ctx, req)
}

// GenerateRankList 作业助手排行榜-根据DB数据生成排行榜
func (h *HomeworkAssistantV1HomeworkAssistantService) GenerateRankList(ctx context.Context, req *pb.GenerateRankListRequest) (*pb.GenerateRankListReply, error) {
	return h.homeworkAssistantV1HomeworkAssistantUseCase.GenerateRankList(ctx, req)
}
