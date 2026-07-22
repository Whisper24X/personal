package v1

import (
	"github.com/go-kratos/kratos/v2/transport/http"
)

type NpsHTTPCustomServer interface {
	NpsPopupUseListDownload(http.Context, *NpsPopupUseListDownloadCustomRequest) (*NpsPopupUseListDownloadCustomReply, error)
	NpsSummaryDownload(http.Context, *NpsSummaryDownloadRequest) (*NpsSummaryDownloadReply, error)
}

func RegisterNpsHTTPCustomServer(s *http.Server, srv NpsHTTPCustomServer) {
	r := s.Route("/")
	r.GET("/devices-learn/shadow/nps/popup/user/list/download", NpsPopupUseListDownloadHTTPHandler(srv))
	r.GET("/devices-learn/shadow/nps/summary/download", NpsSummaryDownloadHTTPHandler(srv))
}

type NpsPopupUseListDownloadCustomRequest struct {
	Stage     int64  `json:"stage"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}
type NpsPopupUseListDownloadCustomReply struct {
}

func NpsPopupUseListDownloadHTTPHandler(srv NpsHTTPCustomServer) func(ctx http.Context) error {
	return func(ctx http.Context) error {
		var in NpsPopupUseListDownloadCustomRequest
		if err := ctx.BindQuery(&in); err != nil {
			return err
		}
		out, err := srv.NpsPopupUseListDownload(ctx, &in)
		if err != nil {
			return err
		}
		return ctx.Result(200, &out)
	}
}

type NpsSummaryDownloadRequest struct {
	StartTime   string `json:"startTime"`   // 开始时间：格式：2006-01-02
	EndTime     string `json:"endTime"`     // 结束时间：格式：2006-01-02
	SearchRange string `json:"searchRange"` // 查询范围：week、month
}

type NpsSummaryDownloadReply struct {
}

func NpsSummaryDownloadHTTPHandler(srv NpsHTTPCustomServer) func(ctx http.Context) error {
	return func(ctx http.Context) error {
		var in NpsSummaryDownloadRequest
		if err := ctx.BindQuery(&in); err != nil {
			return err
		}
		out, err := srv.NpsSummaryDownload(ctx, &in)
		if err != nil {
			return err
		}
		return ctx.Result(200, &out)
	}
}
