package biz

import (
	"context"

	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/meta"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
)

// SysAdminList 管理用户-列表
func (s *ShadowV1SysAdminUseCase) SysAdminList(ctx context.Context, req *pb.SysAdminListReq) (*pb.SysAdminListReply, error) {
	resp := &pb.SysAdminListReply{
		Total: 0,
		List:  make([]*pb.SysAdminInfo, 0),
	}
	// 获取当前管理员ID
	adminId := meta.GetAdminID(ctx)
	// 查询当前管理员可以查看的用户ID
	canViewAdminIds, err := s.bffRepo.FindAdminCanViewAdminIds(ctx, adminId)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	param := &condition.Req{
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
		Query: []*condition.QueryParam{
			{
				Field: "id",
				Value: canViewAdminIds,
				Exp:   condition.IN,
				Logic: condition.AND,
			},
		},
		Order: []*condition.OrderParam{
			{
				Field: "createdAt",
				Order: condition.DESC,
			},
		},
	}
	if req.GetPhone() != "" {
		ph, err := cryptutil.YcPhoneItemEncrypt(req.GetPhone())
		if err != nil {
			return nil, errorx.DataEncryptErr.WithError(err).Err()
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "ph",
			Value: "%" + ph + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	if req.GetNickname() != "" {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "nickname",
			Value: "%" + req.GetNickname() + "%",
			Exp:   condition.LIKE,
			Logic: condition.AND,
		})
	}
	if req.GetStatus() != 0 {
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "status",
			Value: req.GetStatus(),
			Exp:   condition.EQ,
			Logic: condition.AND,
		})
	}
	// 去重和去空
	roleIds := lo.Uniq(req.GetRoleIds())
	roleIds = lo.Filter(roleIds, func(item string, _ int) bool {
		return item != ""
	})
	if len(roleIds) > 0 {
		// 查询角色对应的adminId
		sysAdminRoles, err := s.sysAdminRoleRepo.FindMultiCacheByRoleIDS(ctx, roleIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		roleAdminIds := make([]interface{}, 0)
		for _, v := range sysAdminRoles {
			roleAdminIds = append(roleAdminIds, v.AdminID)
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "id",
			Value: roleAdminIds,
			Exp:   condition.IN,
			Logic: condition.AND,
		})
	}
	// 去重和去空
	deptIds := lo.Uniq(req.GetDeptIds())
	deptIds = lo.Filter(deptIds, func(item string, _ int) bool {
		return item != ""
	})
	if len(deptIds) > 0 {
		sysAdminDepts, err := s.sysAdminDeptRepo.FindMultiCacheByDeptIDS(ctx, deptIds)
		if err != nil {
			return nil, errorx.DataSQLErr.WithError(err).Err()
		}
		deptAdminIds := make([]interface{}, 0)
		for _, v := range sysAdminDepts {
			deptAdminIds = append(deptAdminIds, v.AdminID)
		}
		param.Query = append(param.Query, &condition.QueryParam{
			Field: "id",
			Value: deptAdminIds,
			Exp:   condition.IN,
			Logic: condition.AND,
		})
	}
	sysAdmins, p, err := s.sysAdminRepo.FindMultiByCondition(ctx, param)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	resp.Total = p.Total
	if len(sysAdmins) == 0 {
		return resp, nil
	}
	resp.List, err = s.bffRepo.FindMultiAdminsRoleAndDept(ctx, sysAdmins)
	if err != nil {
		return nil, errorx.DataSQLErr.WithError(err).Err()
	}
	return resp, nil
}
