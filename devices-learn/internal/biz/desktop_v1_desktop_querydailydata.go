package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/desktop/v1"
)

// QueryDailyData 查询每日数据
func (d *DesktopV1DesktopUseCase) QueryDailyData(ctx context.Context, req *pb.QueryDailyDataRequest) (*pb.QueryDailyDataReply, error) {
	resp := &pb.QueryDailyDataReply{}
	return resp, nil
}
