package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/devices-learn/api/learn_config/v1"
)

// ParseLearnConfigCsvFile 解析学习配置csv文件
func (l *LearnConfigV1LearnConfigUseCase) ParseLearnConfigCsvFile(ctx context.Context, req *pb.ParseLearnConfigCsvFileReq) (*pb.ParseLearnConfigCsvFileReply, error) {
	resp := &pb.ParseLearnConfigCsvFileReply{}
	return resp, nil
}
