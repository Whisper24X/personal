package biz

import (
	"context"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// SysPermissionStore 功能权限-保存
func (s *ShadowV1SysPermissionUseCase) SysPermissionStore(ctx context.Context, req *pb.SysPermissionStoreReq) (*pb.SysPermissionStoreResp, error) {
	resp := &pb.SysPermissionStoreResp{
		Id: "",
	}
	if req.GetId() == "" {
		// 判断名称是否重复
		sysPermissionRepeat, err := s.sysPermissionRepo.FindOneCacheByPath(ctx, req.GetPath())
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		if sysPermissionRepeat != nil && sysPermissionRepeat.ID != "" {
			return nil, errorx.PermissionPathDuplicate.Err()
		}
		// 新增
		sysPermission := &yanxue_model.SysPermission{
			ID:        req.GetId(),
			Pid:       req.GetPid(),
			Type:      req.GetType(),
			Title:     req.GetTitle(),
			Name:      req.GetName(),
			Path:      req.GetPath(),
			Icon:      req.GetIcon(),
			MenuType:  req.GetMenuType(),
			URL:       req.GetUrl(),
			Component: req.GetComponent(),
			Extend:    req.GetExtend(),
			Remark:    req.GetRemark(),
			Status:    int16(req.GetStatus()),
		}
		err = s.sysPermissionRepo.CreateOneCache(ctx, sysPermission)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		resp.Id = sysPermission.ID
	} else {
		// id 不能等于 pid
		if req.GetId() == req.GetPid() {
			return nil, errorx.ParamErr.Err()
		}
		// 判断名称是否重复
		sysPermissionRepeat, err := s.sysPermissionRepo.FindOneCacheByPath(ctx, req.GetPath())
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		if sysPermissionRepeat != nil && sysPermissionRepeat.ID != "" && sysPermissionRepeat.ID != req.GetId() {
			return nil, errorx.PermissionPathDuplicate.Err()
		}
		// 更新
		sysPermission, err := s.sysPermissionRepo.FindOneCacheByID(ctx, req.GetId())
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		if sysPermission == nil || sysPermission.ID == "" {
			return nil, errorx.DataRecordNotFound.Err()
		}
		oldSysPermission := s.sysPermissionRepo.DeepCopy(sysPermission)
		sysPermission.Pid = req.GetPid()
		sysPermission.Type = req.GetType()
		sysPermission.Title = req.GetTitle()
		sysPermission.Name = req.GetName()
		sysPermission.Path = req.GetPath()
		sysPermission.Icon = req.GetIcon()
		sysPermission.MenuType = req.GetMenuType()
		sysPermission.URL = req.GetUrl()
		sysPermission.Component = req.GetComponent()
		sysPermission.Extend = req.GetExtend()
		sysPermission.Remark = req.GetRemark()
		sysPermission.Status = int16(req.GetStatus())
		err = s.sysPermissionRepo.UpdateOneCacheWithZero(ctx, sysPermission, oldSysPermission)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		resp.Id = sysPermission.ID
	}
	return resp, nil
}
