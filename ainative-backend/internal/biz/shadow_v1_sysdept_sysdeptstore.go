package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// SysDeptStore 部门-保存
func (s *ShadowV1SysDeptUseCase) SysDeptStore(ctx context.Context, req *pb.SysDeptStoreReq) (*pb.SysDeptStoreResp, error) {
	resp := &pb.SysDeptStoreResp{
		Id: "",
	}
	var sysDept *yanxue_model.SysDept
	var err error
	if req.GetId() == "" {
		// 新增
		sysDept = &yanxue_model.SysDept{
			ID:     req.GetId(),
			Pid:    req.GetPid(),
			Type:   req.GetType(),
			Name:   req.GetName(),
			Remark: req.GetRemark(),
			Status: int16(req.GetStatus()),
		}
		err := s.sysDeptRepo.CreateOneCache(ctx, sysDept)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		resp.Id = sysDept.ID
	} else {
		// id 不能等于 pid
		if req.GetId() == req.GetPid() {
			return nil, errorx.ParamErr.Err()
		}
		// 更新
		sysDept, err = s.sysDeptRepo.FindOneCacheByID(ctx, req.GetId())
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		if sysDept == nil || sysDept.ID == "" {
			return nil, errorx.DataRecordNotFound.Err()
		}
		oldSysDept := s.sysDeptRepo.DeepCopy(sysDept)
		sysDept.Type = req.GetType()
		sysDept.Pid = req.GetPid()
		sysDept.Name = req.GetName()
		sysDept.Remark = req.GetRemark()
		sysDept.Status = int16(req.GetStatus())
		err = s.sysDeptRepo.UpdateOneCacheWithZero(ctx, sysDept, oldSysDept)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		resp.Id = sysDept.ID
	}
	return resp, nil
}
