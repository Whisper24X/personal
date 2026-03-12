package data

import (
	"context"
	"sort"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_repo"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.SysDeptRepo = (*SysDeptRepo)(nil)

func NewSysDeptRepo(
	logger log.Logger,
	data *Data,
	sysDeptRepo *yanxue_repo.SysDeptRepo,
) biz.SysDeptRepo {
	l := log.NewHelper(log.With(logger, "module", "data/sysDept"), log.WithMessageKey("message"))
	return &SysDeptRepo{
		log:         l,
		data:        data,
		SysDeptRepo: sysDeptRepo,
	}
}

type SysDeptRepo struct {
	log  *log.Helper
	data *Data
	*yanxue_repo.SysDeptRepo
}

// FindAllDeptIds 查询所有的部门
func (s *SysDeptRepo) FindAllDeptIds(ctx context.Context) ([]string, error) {
	// 查询所有部门
	deptList, _, err := s.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return nil, err
	}
	return lo.Map(deptList, func(item *yanxue_model.SysDept, index int) string {
		return item.ID
	}), nil
}

// FindDeptCurrentAndChildrenIds 查询当前部门及其所有子部门的ID列表
func (s *SysDeptRepo) FindDeptCurrentAndChildrenIds(ctx context.Context, deptIds []string) ([]string, error) {
	// 参数验证
	if len(deptIds) == 0 {
		return []string{}, nil
	}

	// 使用map存储结果和已访问节点,避免重复和循环引用
	resultMap := make(map[string]struct{})
	visited := make(map[string]struct{})

	// 添加当前节点
	for _, id := range deptIds {
		resultMap[id] = struct{}{}
	}

	// 考虑使用缓存获取部门数据
	depts, _, err := s.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return nil, err
	}

	// 构建父子关系map,优化查询效率
	childrenMap := make(map[string][]string)
	for _, dept := range depts {
		childrenMap[dept.Pid] = append(childrenMap[dept.Pid], dept.ID)
	}

	// 递归查找子节点
	var findChildren func(pid string)
	findChildren = func(pid string) {
		// 检查是否已访问,避免循环引用
		if _, ok := visited[pid]; ok {
			return
		}
		visited[pid] = struct{}{}

		// 使用预构建的map查找子节点
		children, exists := childrenMap[pid]
		if !exists {
			return
		}

		for _, childId := range children {
			resultMap[childId] = struct{}{}
			findChildren(childId)
		}
	}

	// 开始递归查找
	for _, id := range deptIds {
		findChildren(id)
	}

	// 将map转换为切片
	result := make([]string, 0, len(resultMap))
	for id := range resultMap {
		result = append(result, id)
	}

	return result, nil
}

func (s *SysDeptRepo) BuildTree(sysDepts []*yanxue_model.SysDept, showAll bool, isSelect bool) []*pb.SysDeptInfo {
	// 处理空输入
	if len(sysDepts) == 0 {
		return []*pb.SysDeptInfo{}
	}

	// 创建一个map用于存储id到节点的映射
	nodeMap := make(map[string]*pb.SysDeptInfo)
	// 第一次遍历,创建所有节点
	for _, dept := range sysDepts {
		// 跳过无效的部门记录
		if dept == nil || dept.ID == "" {
			continue
		}

		// 当showAll为false时,只添加status=1的节点
		if !showAll && dept.Status != 1 {
			continue
		}

		node := &pb.SysDeptInfo{
			Id:        dept.ID,
			Pid:       dept.Pid,
			Type:      dept.Type,
			Name:      dept.Name,
			Remark:    dept.Remark,
			Status:    int32(dept.Status),
			CreatedAt: timeutil.RFC3339(dept.CreatedAt),
			UpdatedAt: timeutil.RFC3339(dept.UpdatedAt),
			Children:  []*pb.SysDeptInfo{},
			IsSelect:  isSelect,
		}
		nodeMap[dept.ID] = node
	}

	// 存储根节点
	var roots []*pb.SysDeptInfo
	// 第二次遍历,构建树形结构
	for _, dept := range sysDepts {
		if dept == nil || dept.ID == "" {
			continue
		}

		if dept.Pid == "" {
			// 如果pid为空,则为根节点
			if node, exists := nodeMap[dept.ID]; exists {
				roots = append(roots, node)
			}
		} else {
			// 如果有pid,则添加到父节点的children中
			if parent, exists := nodeMap[dept.Pid]; exists {
				if node, exists := nodeMap[dept.ID]; exists {
					parent.Children = append(parent.Children, node)
				}
			}
		}
	}

	// 排序函数
	sortNodes := func(nodes []*pb.SysDeptInfo) {
		sort.Slice(nodes, func(i, j int) bool {
			// 如果sort相同，按创建时间 升序
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

// BuildCanViewTreeWithSelect 构建部门树形结构，只展示在路径上的树形结构，并设置可选部门
func (s *SysDeptRepo) BuildCanViewTreeWithSelect(ctx context.Context, deptIds []string) ([]*pb.SysDeptInfo, error) {
	// 查询所有部门
	depts, _, err := s.FindMultiByCondition(ctx, &condition.Req{})
	if err != nil {
		return nil, err
	}

	// 创建deptIds的map,方便查找
	deptIdMap := make(map[string]struct{})
	for _, id := range deptIds {
		deptIdMap[id] = struct{}{}
	}

	// 构建完整的树形结构
	tree := s.BuildTree(depts, false, false)

	// 收集所有在路径上的部门ID
	pathDeptIds := make(map[string]struct{})

	// 递归查找所有选中部门的父节点路径
	var findParentPath func(depts []*yanxue_model.SysDept, deptId string)
	findParentPath = func(depts []*yanxue_model.SysDept, deptId string) {
		for _, dept := range depts {
			if dept.ID == deptId {
				pathDeptIds[dept.ID] = struct{}{}
				if dept.Pid != "" {
					findParentPath(depts, dept.Pid)
				}
				break
			}
		}
	}

	// 查找所有选中部门的父节点路径
	for deptId := range deptIdMap {
		findParentPath(depts, deptId)
	}

	// 过滤树形结构，只保留路径上的节点
	var filterTree func(nodes []*pb.SysDeptInfo) []*pb.SysDeptInfo
	filterTree = func(nodes []*pb.SysDeptInfo) []*pb.SysDeptInfo {
		result := make([]*pb.SysDeptInfo, 0)
		for _, node := range nodes {
			// 检查节点是否在路径上
			if _, exists := pathDeptIds[node.Id]; exists {
				// 设置是否可选
				if _, isSelectable := deptIdMap[node.Id]; isSelectable {
					node.IsSelect = true
				}

				// 递归处理子节点
				if len(node.Children) > 0 {
					node.Children = filterTree(node.Children)
				}
				result = append(result, node)
			}
		}
		return result
	}

	// 过滤并返回最终的树形结构
	return filterTree(tree), nil
}
