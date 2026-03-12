package biz

import (
	"context"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/fileutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

func (s *ShadowV1ContractUseCase) ExportContractCsv(ctx context.Context, contractList *pb.QueryContractListReply, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// 写入表头
	headers := []string{
		"家长姓名｜parent_name",
		"家长电话｜parent_phone",
		"孩子姓名｜child_name",
		"孩子电话｜child_phone",
		"身份证号｜child_id",
		"用户背景｜user_source",
		"主题｜topic",
		"营期开始时间｜activity_start_date",
		"营期结束时间｜activity_end_date",
		"购买渠道｜purchase_channel",
		"孩子年级｜child_grade",
		"孩子性别｜child_gender",
		"参营费用｜cost",
		"参营费用大写｜cost_capital",
		"支付截止时间｜pay_end_date",
		"合同状态",
		"合同链接",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	// 写入数据
	for _, v := range contractList.List {
		record := []string{
			v.ParentName,
			v.ParentPhone,
			v.ChildName,
			v.ChildPhone,
			v.ChildId,
			v.UserSource,
			v.Topic,
			v.ActivityStartDate,
			v.ActivityEndDate,
			v.PurchaseChannel,
			v.ChildGrade,
			v.ChildGender,
			v.Cost,
			v.CostCapital,
			v.PayEndDate,
			constant.ContractStatusMap[int(v.ContractStatus)],
			v.ContractLink,
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}

	return nil
}

// ExportContractList 导出合同列表
func (s *ShadowV1ContractUseCase) ExportContractList(ctx context.Context, req *pb.ExportContractListReq) (*pb.ExportContractListReply, error) {
	resp := &pb.ExportContractListReply{}
	reply, err := s.QueryContractList(ctx, &pb.QueryContractListReq{
		ChildName:         req.GetChildName(),
		ParentPhone:       req.GetParentPhone(),
		Topic:             req.GetTopic(),
		Status:            req.GetStatus(),
		ActivityStartDate: req.GetActivityStartDate(),
		Page:              1,
		PageSize:          5000,
	})
	if err != nil {
		return resp, errorx.DataSQLErr.WithError(err).Err()
	}

	if len(reply.List) == 0 {
		return resp, nil
	}

	key := cryptutil.Sha256(req.String())

	// 获取当前工作目录的绝对路径
	currentDir, err := os.Getwd()
	if err != nil {
		s.log.Errorf("获取当前工作目录失败！err: %v", err)
		return resp, err
	}
	dirPath := filepath.Join(currentDir, "yanxue-export", "contract")
	// 检查目录是否存在，不存在则创建
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			s.log.Errorf("创建文件夹失败！err: %v", err)
			return resp, err
		}
	}
	path := filepath.Join(dirPath, fmt.Sprintf("%s_%s.csv", timeutil.NowCarbon().ToShortDateTimeString(), key))
	defer func() {
		_ = fileutil.Remove(path)
	}()

	// 生成csv文件
	err = s.ExportContractCsv(ctx, reply, path)
	if err != nil {
		return resp, err
	}

	// 上传到oss
	downloadUrl, err := s.ycOssHttpRpc.UploadOss(ctx, path)
	if err != nil {
		return resp, err
	}

	resp.DownloadUrl = downloadUrl
	return resp, nil
}
