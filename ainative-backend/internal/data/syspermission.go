package data

import (
	"context"
	"sort"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.SysPermissionRepo = (*SysPermissionRepo)(nil)

func NewSysPermissionRepo(
	logger log.Logger,
	data *Data,
	sysPermissionRepo *yanxue_repo.SysPermissionRepo,
) biz.SysPermissionRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysPermission"), log.WithMessageKey("message"))
	return &SysPermissionRepo{
		log:               l,
		data:              data,
		SysPermissionRepo: sysPermissionRepo,
	}
}

type SysPermissionRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SysPermissionRepo
}

// BuildTree 构建树形结构
// showAll: true显示所有状态节点, false只显示status=1的节点
// 排序：sort字段 升序 创建时间 升序
func (s *SysPermissionRepo) BuildTree(sysPermissions []*yanxue_model.SysPermission, showAll bool) []*pb.SysPermissionInfo {
	// 处理空输入
	if len(sysPermissions) == 0 {
		return []*pb.SysPermissionInfo{}
	}

	// 创建一个map用于存储id到节点的映射
	nodeMap := make(map[string]*pb.SysPermissionInfo)

	// 第一次遍历,创建所有节点
	for _, permission := range sysPermissions {
		// 跳过无效的权限记录
		if permission == nil || permission.ID == "" {
			continue
		}

		// 当showAll为false时,只添加status=1的节点
		if !showAll && permission.Status != 1 {
			continue
		}

		node := &pb.SysPermissionInfo{
			Id:        permission.ID,
			Pid:       permission.Pid,
			Type:      permission.Type,
			Title:     permission.Title,
			Name:      permission.Name,
			Path:      permission.Path,
			Icon:      permission.Icon,
			MenuType:  permission.MenuType,
			Url:       permission.URL,
			Component: permission.Component,
			Extend:    permission.Extend,
			Remark:    permission.Remark,
			Status:    int32(permission.Status),
			CreatedAt: timeutil.RFC3339(permission.CreatedAt.Time),
			UpdatedAt: timeutil.RFC3339(permission.UpdatedAt.Time),
			Children:  []*pb.SysPermissionInfo{},
		}
		nodeMap[permission.ID] = node
	}

	// 存储根节点
	var roots []*pb.SysPermissionInfo

	// 第二次遍历,构建树形结构
	for _, permission := range sysPermissions {
		if permission == nil || permission.ID == "" {
			continue
		}

		if permission.Pid == "" {
			// 如果pid为空,则为根节点
			if node, exists := nodeMap[permission.ID]; exists {
				roots = append(roots, node)
			}
		} else {
			// 如果有pid,则添加到父节点的children中
			if parent, exists := nodeMap[permission.Pid]; exists {
				if node, exists := nodeMap[permission.ID]; exists {
					parent.Children = append(parent.Children, node)
				}
			}
		}
	}

	// 排序函数
	sortNodes := func(nodes []*pb.SysPermissionInfo) {
		sort.Slice(nodes, func(i, j int) bool {
			// 如果sort相同，按创建时间升序
			iTime, _ := time.Parse(time.RFC3339, nodes[i].CreatedAt)
			jTime, _ := time.Parse(time.RFC3339, nodes[j].CreatedAt)
			return iTime.Before(jTime)
		})
	}

	// 对根节点进行排序
	if len(roots) > 0 {
		sortNodes(roots)
	}

	// 对每个节点的子节点进行排序
	for _, node := range nodeMap {
		if len(node.Children) > 0 {
			sortNodes(node.Children)
		}
	}

	return roots
}

// FindPermissionCurrentAndChildrenIds 查询当前权限节点及其所有子节点的ID列表
func (s *SysPermissionRepo) FindPermissionCurrentAndChildrenIds(ctx context.Context, permissionID string) ([]string, error) {
	// 使用map存储结果，避免重复
	resultMap := make(map[string]struct{})

	// 添加当前节点
	resultMap[permissionID] = struct{}{}

	// 查询所有权限节点
	permissions, _, err := s.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return nil, err
	}

	// 递归查找子节点
	var findChildren func(pid string)
	findChildren = func(pid string) {
		for _, p := range permissions {
			if p.Pid == pid {
				resultMap[p.ID] = struct{}{}
				// 递归查找当前节点的子节点
				findChildren(p.ID)
			}
		}
	}

	// 开始递归查找
	findChildren(permissionID)

	// 将map转换为切片
	result := make([]string, 0, len(resultMap))
	for id := range resultMap {
		result = append(result, id)
	}

	return result, nil
}
