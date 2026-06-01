package data

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-redis/redis/v8"
	"github.com/samber/lo"
	"gitlab.yc345.tv/backend/orm-gen/v2/condition"
	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/biz"
	"gitlab.yc345.tv/backend/yanxue/internal/data/constant"
	"gitlab.yc345.tv/backend/yanxue/internal/data/errorx"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
	"gitlab.yc345.tv/backend/yanxue/internal/data/rpc"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/cryptutil"
	"gitlab.yc345.tv/backend/yanxue/internal/pkg/util/timeutil"
)

var _ biz.BffRepo = (*BffRepo)(nil)

func NewBffRepo(
	logger log.Logger,
	data *Data,
	commonRepo biz.CommonRepo,
	ycOssHttpRpc *rpc.YcOssHttpRpc,
	sysAdminRepo biz.SysAdminRepo,
	sysRoleRepo biz.SysRoleRepo,
	sysDeptRepo biz.SysDeptRepo,
	sysPermissionRepo biz.SysPermissionRepo,
	sysAdminRoleRepo biz.SysAdminRoleRepo,
	sysAdminDeptRepo biz.SysAdminDeptRepo,
	sysRolePermissionRepo biz.SysRolePermissionRepo,
	userRepo biz.UserRepo,
	courseRepo biz.CourseRepo,
	courseStockRepo biz.CourseStockRepo,
	courseAppointmentRepo biz.CourseAppointmentRepo,
	orderRepo biz.OrderRepo,
	goodRepo biz.GoodRepo,
) biz.BffRepo {
	l := log.NewHelper(log.With(logger, "module", "data/bffRepo"), log.WithMessageKey("message"))
	return &BffRepo{
		log:                   l,
		data:                  data,
		ycOssHttpRpc:          ycOssHttpRpc,
		commonRepo:            commonRepo,
		sysAdminRepo:          sysAdminRepo,
		sysRoleRepo:           sysRoleRepo,
		sysDeptRepo:           sysDeptRepo,
		sysPermissionRepo:     sysPermissionRepo,
		sysAdminRoleRepo:      sysAdminRoleRepo,
		sysAdminDeptRepo:      sysAdminDeptRepo,
		sysRolePermissionRepo: sysRolePermissionRepo,
		userRepo:              userRepo,
		courseRepo:            courseRepo,
		courseStockRepo:       courseStockRepo,
		courseAppointmentRepo: courseAppointmentRepo,
		orderRepo:             orderRepo,
		goodRepo:              goodRepo,
	}
}

type BffRepo struct {
	log                   *log.Helper
	data                  *Data
	ycOssHttpRpc          *rpc.YcOssHttpRpc
	commonRepo            biz.CommonRepo
	sysAdminRepo          biz.SysAdminRepo
	sysRoleRepo           biz.SysRoleRepo
	sysDeptRepo           biz.SysDeptRepo
	sysPermissionRepo     biz.SysPermissionRepo
	sysAdminRoleRepo      biz.SysAdminRoleRepo
	sysAdminDeptRepo      biz.SysAdminDeptRepo
	sysRolePermissionRepo biz.SysRolePermissionRepo
	userRepo              biz.UserRepo
	courseRepo            biz.CourseRepo
	courseStockRepo       biz.CourseStockRepo
	courseAppointmentRepo biz.CourseAppointmentRepo
	orderRepo             biz.OrderRepo
	goodRepo              biz.GoodRepo
}

// QueryAndUploadCSV 查询并上传 CSV 文件
func (s *BffRepo) QueryAndUploadCSV(ctx context.Context, key string, filePath string, fn func() ([][]string, error)) (string, error) {
	fileKey := fmt.Sprintf("csv:%s", key)
	fileLockKey := fmt.Sprintf("csv:lock:%s", key)

	// 1. 先检查缓存中是否已有下载链接
	downloadUrl, err := s.data.goRedisClient.Get(ctx, fileKey).Result()
	if err != nil && err != redis.Nil {
		s.log.Errorf("获取CSV文件缓存失败: %v", err)
		return "", err
	}
	if downloadUrl != "" {
		return downloadUrl, nil
	}
	// 3. 启动异步任务生成CSV
	go func() {
		// 4. 使用分布式锁防止重复生成
		lock, err := s.data.goRedisClient.SetNX(ctx, fileLockKey, "1", 5*time.Minute).Result()
		if err != nil {
			s.log.Errorf("设置CSV文件锁失败: %v", err)
			return
		}

		// 如果已经有其他进程在处理，直接返回
		if !lock {
			s.log.Infof("CSV文件 %s 正在被其他进程生成", key)
			return
		}

		// 5. 确保锁会被释放
		defer func() {
			if err := s.data.goRedisClient.Del(ctx, fileLockKey).Err(); err != nil {
				s.log.Errorf("释放CSV文件锁失败: %v", err)
			}
		}()

		// 6. 添加恢复机制，防止panic导致goroutine崩溃
		defer func() {
			if r := recover(); r != nil {
				s.log.Errorf("生成CSV文件过程中发生panic: %v", r)
			}
		}()

		// 7. 生成CSV数据
		csvData, err := fn()
		if err != nil {
			s.log.Errorf("生成CSV数据失败: %v", err)
			return
		}

		// 8. 上传CSV文件到OSS
		// 8.1 确保目录存在并创建本地CSV文件
		dir := filepath.Dir(filePath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			s.log.Errorf("创建目录失败: %v", err)
			return
		}

		file, err := os.Create(filePath)
		if err != nil {
			s.log.Errorf("创建CSV文件失败: %v", err)
			return
		}
		defer file.Close()

		// 8.2 写入CSV数据
		writer := csv.NewWriter(file)
		defer writer.Flush()
		err = writer.WriteAll(csvData)
		if err != nil {
			s.log.Errorf("写入CSV数据失败: %v", err)
			return
		}

		// 8.3 上传到OSS
		downloadUrl, err := s.ycOssHttpRpc.UploadOss(ctx, filePath)
		if err != nil {
			s.log.Errorf("上传CSV文件到OSS失败: %v", err)
			return
		}

		// 9. 缓存下载链接，设置更合理的缓存时间
		err = s.data.goRedisClient.Set(ctx, fileKey, downloadUrl, time.Minute*2).Err()
		if err != nil {
			s.log.Errorf("缓存CSV文件下载链接失败: %v", err)
			return
		}
	}()
	// 10. 与原方法保持一致，返回空字符串和nil错误
	// 调用方需要理解这意味着文件正在异步生成中
	return "", nil
}

// FindAdminCanViewDeptIds 查询当前用户的角色权限中对应的部门Ids
func (s *BffRepo) FindAdminCanViewDeptIds(ctx context.Context, adminId string) ([]string, error) {
	result := make([]string, 0)
	sysAdminRoles, err := s.sysAdminRoleRepo.FindMultiCacheByAdminID(ctx, adminId)
	if err != nil {
		return nil, err
	}
	if len(sysAdminRoles) == 0 {
		return nil, nil
	}
	sysAdminRoleIds := lo.Map(sysAdminRoles, func(item *yanxue_model.SysAdminRole, index int) string {
		return item.RoleID
	})
	sysRoles, err := s.sysRoleRepo.FindMultiCacheByIDS(ctx, sysAdminRoleIds)
	if err != nil {
		return nil, err
	}
	// 数据权限的优先级 ： all > deptAndBelow > dept > self 获取优先级最大的权限
	dataPermission, err := s.sysRoleRepo.GetDataPermissionPriority(ctx, sysRoles)
	if err != nil {
		return nil, err
	}
	switch dataPermission {
	case constant.SysRoleDataPermissionTypeAll: // 全部
		deptIds, err := s.sysDeptRepo.FindAllDeptIds(ctx)
		if err != nil {
			return nil, err
		}
		result = append(result, deptIds...)
	case constant.SysRoleDataPermissionTypeDept: // 当前部门
		deptIds, err := s.sysAdminDeptRepo.FindMultiCacheByAdminID(ctx, adminId)
		if err != nil {
			return nil, err
		}
		result = lo.Map(deptIds, func(item *yanxue_model.SysAdminDept, index int) string {
			return item.DeptID
		})
	case constant.SysRoleDataPermissionTypeDeptAndBelow: // 当前部门及以下
		// 查询当前用户关联的部门
		sysAdminDepts, err := s.sysAdminDeptRepo.FindMultiCacheByAdminID(ctx, adminId)
		if err != nil {
			return nil, err
		}
		sysAdminDeptIds := lo.Map(sysAdminDepts, func(item *yanxue_model.SysAdminDept, index int) string {
			return item.DeptID
		})
		result, err = s.sysDeptRepo.FindDeptCurrentAndChildrenIds(ctx, sysAdminDeptIds)
		if err != nil {
			return nil, err
		}
	case constant.SysRoleDataPermissionTypeSelf: // 自己
		deptIds, err := s.sysAdminDeptRepo.FindMultiCacheByAdminID(ctx, adminId)
		if err != nil {
			return nil, err
		}
		result = lo.Map(deptIds, func(item *yanxue_model.SysAdminDept, index int) string {
			return item.DeptID
		})
	}
	return result, nil
}

// FindAdminCanViewStoreIds 查询当前用户的角色权限中对应的门店Ids
func (s *BffRepo) FindAdminCanViewStoreIds(ctx context.Context, adminId string) ([]string, error) {
	result := make([]string, 0)
	deptIds, err := s.FindAdminCanViewDeptIds(ctx, adminId)
	if err != nil {
		return nil, err
	}
	// 查询组织信息
	deptList, err := s.sysDeptRepo.FindMultiCacheByIDS(ctx, deptIds)
	if err != nil {
		return nil, err
	}
	for _, dept := range deptList {
		if dept.Type == constant.SysDeptTypeLeaf.String() && dept.Status == int16(constant.SysStatusEnable) {
			result = append(result, dept.ID)
		}
	}
	return result, nil
}

// FindAdminCanViewAdminIds 查询当前用户可以查看的用户Id
func (s *BffRepo) FindAdminCanViewAdminIds(ctx context.Context, adminId string) ([]string, error) {
	result := make([]string, 0)

	// 查询角色
	sysAdminRoles, err := s.sysAdminRoleRepo.FindMultiCacheByAdminID(ctx, adminId)
	if err != nil {
		return nil, err
	}
	sysAdminRoleIds := lo.Map(sysAdminRoles, func(item *yanxue_model.SysAdminRole, index int) string {
		return item.RoleID
	})
	sysRoles, err := s.sysRoleRepo.FindMultiCacheByIDS(ctx, sysAdminRoleIds)
	if err != nil {
		return nil, err
	}
	// 数据权限的优先级 ： all > deptAndBelow > dept > self 获取优先级最大的权限
	dataPermission, err := s.sysRoleRepo.GetDataPermissionPriority(ctx, sysRoles)
	if err != nil {
		return nil, err
	}
	switch dataPermission {
	case constant.SysRoleDataPermissionTypeAll:
		// 查询所有用户
		sysAdmins, _, err := s.sysAdminRepo.FindMultiByCondition(ctx, &condition.Req{})
		if err != nil {
			return nil, err
		}
		result = lo.Map(sysAdmins, func(item *yanxue_model.SysAdmin, index int) string {
			return item.ID
		})
	case constant.SysRoleDataPermissionTypeDept:
		// 查询当前部门的用户
		sysAdminDepts, err := s.sysAdminDeptRepo.FindMultiCacheByAdminID(ctx, adminId)
		if err != nil {
			return nil, err
		}
		sysAdminDeptIds := lo.Map(sysAdminDepts, func(item *yanxue_model.SysAdminDept, index int) string {
			return item.DeptID
		})
		sysAdmins, err := s.sysAdminDeptRepo.FindMultiCacheByDeptIDS(ctx, sysAdminDeptIds)
		if err != nil {
			return nil, err
		}
		result = lo.Map(sysAdmins, func(item *yanxue_model.SysAdminDept, index int) string {
			return item.AdminID
		})
	case constant.SysRoleDataPermissionTypeDeptAndBelow:
		// 查询当前用户关联的部门
		sysAdminDepts, err := s.sysAdminDeptRepo.FindMultiCacheByAdminID(ctx, adminId)
		if err != nil {
			return nil, err
		}
		sysAdminDeptIds := lo.Map(sysAdminDepts, func(item *yanxue_model.SysAdminDept, index int) string {
			return item.DeptID
		})
		deptIds, err := s.sysDeptRepo.FindDeptCurrentAndChildrenIds(ctx, sysAdminDeptIds)
		if err != nil {
			return nil, err
		}
		sysAdmins, err := s.sysAdminDeptRepo.FindMultiCacheByDeptIDS(ctx, deptIds)
		if err != nil {
			return nil, err
		}
		result = lo.Map(sysAdmins, func(item *yanxue_model.SysAdminDept, index int) string {
			return item.AdminID
		})
	case constant.SysRoleDataPermissionTypeSelf:
		result = append(result, adminId)
	}
	return result, nil
}

// FindMultiAdminsRoleAndDept 查询多个管理员的角色和部门的正常数据
func (s *BffRepo) FindMultiAdminsRoleAndDept(ctx context.Context, sysAdmins []*yanxue_model.SysAdmin) ([]*pb.SysAdminInfo, error) {
	sysAdminIds := lo.Map(sysAdmins, func(item *yanxue_model.SysAdmin, _ int) string {
		return item.ID
	})
	// 获取管理员角色关联数据
	sysAdminRoles, err := s.sysAdminRoleRepo.FindMultiCacheByAdminIDS(ctx, sysAdminIds)
	if err != nil {
		return nil, err
	}

	// 获取角色ID列表
	roleIds := lo.Map(sysAdminRoles, func(item *yanxue_model.SysAdminRole, _ int) string {
		return item.RoleID
	})

	// 获取角色数据 状态为正常的数据
	roles, err := s.sysRoleRepo.FindMultiCacheByIDS(ctx, roleIds)
	if err != nil {
		return nil, err
	}
	roles = lo.Filter(roles, func(item *yanxue_model.SysRole, _ int) bool {
		return item.Status == int16(constant.SysStatusEnable)
	})
	// 获取管理员部门关联数据 状态为正常的数据
	sysAdminDepts, err := s.sysAdminDeptRepo.FindMultiCacheByAdminIDS(ctx, sysAdminIds)
	if err != nil {
		return nil, err
	}

	// 获取部门ID列表
	deptIds := lo.Map(sysAdminDepts, func(item *yanxue_model.SysAdminDept, _ int) string {
		return item.DeptID
	})

	// 获取部门数据 状态为正常的数据
	depts, err := s.sysDeptRepo.FindMultiCacheByIDS(ctx, deptIds)
	if err != nil {
		return nil, err
	}
	depts = lo.Filter(depts, func(item *yanxue_model.SysDept, _ int) bool {
		return item.Status == int16(constant.SysStatusEnable)
	})

	// 先建立ID到role/dept的映射,避免内层循环查找
	roleMap := make(map[string]*yanxue_model.SysRole)
	for _, role := range roles {
		roleMap[role.ID] = role
	}

	deptMap := make(map[string]*yanxue_model.SysDept)
	for _, dept := range depts {
		deptMap[dept.ID] = dept
	}

	// 构建admin到role/dept的映射
	adminRoleMap := make(map[string][]*pb.SysAdminRoleInfo)
	adminDeptMap := make(map[string][]*pb.SysAdminDeptInfo)
	for _, ar := range sysAdminRoles {
		if role, exists := roleMap[ar.RoleID]; exists {
			adminRoleMap[ar.AdminID] = append(adminRoleMap[ar.AdminID], &pb.SysAdminRoleInfo{
				RoleId:   role.ID,
				RoleName: role.Name,
			})
		}
	}
	for _, ad := range sysAdminDepts {
		if dept, exists := deptMap[ad.DeptID]; exists {
			adminDeptMap[ad.AdminID] = append(adminDeptMap[ad.AdminID], &pb.SysAdminDeptInfo{
				DeptId:   dept.ID,
				DeptName: dept.Name,
			})
		}
	}
	// 组装返回数据
	result := make([]*pb.SysAdminInfo, 0)
	for _, admin := range sysAdmins {
		phone, err := cryptutil.YcPhoneDecrypt(admin.Ph)
		if err != nil {
			return nil, errorx.DataEncryptErr.WithError(err).Err()
		}
		// 组装管理员信息
		adminInfo := &pb.SysAdminInfo{
			Id:          admin.ID,
			Phone:       phone,
			Nickname:    admin.Nickname,
			Avatar:      admin.Avatar,
			Status:      int32(admin.Status),
			IsChangePwd: admin.IsChangePwd,
			CreatedAt:   timeutil.RFC3339(admin.CreatedAt),
			UpdatedAt:   timeutil.RFC3339(admin.UpdatedAt),
			RoleList:    adminRoleMap[admin.ID],
			DeptList:    adminDeptMap[admin.ID],
		}
		result = append(result, adminInfo)
	}
	return result, nil
}

// 校验用户是否可以预约课程
func (s *BffRepo) CheckCourseAppointment(ctx context.Context, order *yanxue_model.Order, good *yanxue_model.Good, courseAppointment *yanxue_model.CourseAppointment) error {
	// 订单状态 待预约 已预约 才可以继续预约
	if !lo.Contains([]string{constant.OrderStatusPending.String(), constant.OrderStatusSuccess.String()}, order.Status) {
		return errorx.CourseAppointmentNotAllowedForOrderStatus.Err()
	}
	// 商品状态只有已上架才能预约
	if good.Status != constant.GoodStatusPutOn.String() {
		return errorx.CourseAppointmentNotAllowedForGoodStatus.Err()
	}
	// 预约状态只能是已预约
	if courseAppointment.Status != constant.CourseAppointmentStatusSuccess.String() {
		return errorx.CourseAppointmentStatusNotAllowed.Err()
	}
	// 获取商品该分类下可以预约的课程与课程数量
	goodContent := &pb.GoodContent{}
	err := json.Unmarshal(good.Content, goodContent)
	if err != nil {
		return errorx.DataFormattingError.WithError(err).Err()
	}
	// 可以预约的课程次数
	var canAppointmentUseTimes int32 = 0
	// 可以预约的课程Id
	var canAppointmentCourseIds []string
	// 已预约的课程次数
	var alreadyAppointmentUseTimes int32 = 0
	// 已预约的课程Id
	var alreadyAppointmentCourseIds []string
	for _, v := range goodContent.GoodCategories {
		// 判断商品分类是否一致
		if v.CategoryId == courseAppointment.CategoryID {
			canAppointmentUseTimes = v.UseTimes
			canAppointmentCourseIds = lo.Map(v.Courses, func(item *pb.CourseItem, _ int) string {
				return item.CourseId
			})
			break
		}
	}
	// 校验课程是否存在
	if !lo.Contains(canAppointmentCourseIds, courseAppointment.CourseID) {
		return errorx.CourseAppointmentNotAllowedForCourseNotExists.Err()
	}
	// 校验当前预约的课程是否约满
	courseAppointments, err := s.courseAppointmentRepo.FindMultiCacheByOrderID(ctx, order.ID)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	for _, v := range courseAppointments {
		if lo.Contains([]string{constant.CourseAppointmentStatusSuccess.String(), constant.CourseAppointmentStatusCompleted.String()}, v.Status) && v.CategoryID == courseAppointment.CategoryID && lo.Contains(canAppointmentCourseIds, v.CourseID) && v.ID != courseAppointment.ID {
			alreadyAppointmentUseTimes++
			alreadyAppointmentCourseIds = append(alreadyAppointmentCourseIds, v.CourseID)
		}
	}
	// 已预约的课程次数不能大于可以预约的课程次数
	if alreadyAppointmentUseTimes >= canAppointmentUseTimes {
		return errorx.CourseAppointmentNotAllowedForStock.Err()
	}
	// 校验课程是否存在
	courseInfo, err := s.courseRepo.FindOneCacheByID(ctx, courseAppointment.CourseID)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	if courseInfo == nil || courseInfo.ID == "" {
		return errorx.CourseAppointmentNotAllowedForCourseNotExists.Err()
	}
	// 校验课程状态
	if courseInfo.Status != constant.CourseStatusPutOn.String() {
		return errorx.CourseIsPutOff.Err()
	}
	// 查询当前课程的库存
	courseStock, err := s.courseStockRepo.FindOneCacheByCourseIDDatePeriod(ctx, courseAppointment.CourseID, courseAppointment.Date, courseAppointment.Period)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	if courseStock == nil || courseStock.ID == "" {
		return errorx.CourseStockNotSet.Err()
	}
	alreadyCourseAppointments, err := s.courseAppointmentRepo.FindMultiCacheByCourseIDDatePeriod(ctx, courseAppointment.CourseID, courseAppointment.Date, courseAppointment.Period)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	alreadyCourseAppointments = lo.Filter(alreadyCourseAppointments, func(item *yanxue_model.CourseAppointment, _ int) bool {
		return item.ID != courseAppointment.ID && lo.Contains([]string{constant.CourseAppointmentStatusSuccess.String(), constant.CourseAppointmentStatusCompleted.String()}, item.Status)
	})
	// 已预约的课程次数不能大于课程的库存
	if int32(len(alreadyCourseAppointments)) >= courseStock.Stock {
		return errorx.CourseAppointmentNotAllowedForStockNotEnough.Err()
	}
	return nil
}

// FinishOrderItem 订单-结束-单条
func (s *BffRepo) FinishOrderItem(ctx context.Context, orderId string) error {
	// 查询订单信息
	order, err := s.orderRepo.FindOneCacheByID(ctx, orderId)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	// 如果订单不存在，则直接返回
	if order == nil || order.ID == "" {
		return nil
	}
	// 如果订单状态为已完成或已退款，则直接返回
	if order.Status == constant.OrderStatusCompleted.String() || order.Status == constant.OrderStatusRefunded.String() {
		return nil
	}
	// 查询商品信息
	good, err := s.goodRepo.FindOneCacheByID(ctx, order.GoodID)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	// 如果商品不存在，则直接返回
	if good == nil || good.ID == "" {
		return nil
	}
	// 获取商品该分类下可以预约的课程与课程数量
	goodContent := &pb.GoodContent{}
	err = json.Unmarshal(good.Content, goodContent)
	if err != nil {
		return errorx.DataFormattingError.WithError(err).Err()
	}
	categoryIdToUseTimes := make(map[string]int32)
	for _, v := range goodContent.GoodCategories {
		categoryIdToUseTimes[v.CategoryId] = v.UseTimes
	}
	// 查询订单商品预约信息
	courseAppointment, err := s.courseAppointmentRepo.FindMultiCacheByOrderID(ctx, orderId)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	// 过滤已完成的预约信息
	courseAppointment = lo.Filter(courseAppointment, func(item *yanxue_model.CourseAppointment, _ int) bool {
		return item.Status == constant.CourseAppointmentStatusCompleted.String()
	})
	// 如果预约信息不存在，则直接返回
	if len(courseAppointment) == 0 {
		return nil
	}
	hasCategoryIdToUseTimes := make(map[string]int32)
	for _, v := range courseAppointment {
		hasCategoryIdToUseTimes[v.CategoryID]++
	}
	// 如果都已预约完成，则更新订单为已完成
	var finishOrder bool = true
	for categoryId, useTimes := range categoryIdToUseTimes {
		if hasCategoryIdToUseTimes[categoryId] != useTimes {
			finishOrder = false
			break
		}
	}
	if finishOrder {
		oldOrder := s.orderRepo.DeepCopy(order)
		order.ServiceStatus = constant.OrderStatusCompleted.String()
		err = s.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
		if err != nil {
			return errorx.DataSQLErr.WithError(err).Err()
		}
	}
	return nil
}

// CancelOrder 订单-取消-单条
func (s *BffRepo) CancelOrder(ctx context.Context, orderId string) error {
	// 查询订单信息
	order, err := s.orderRepo.FindOneCacheByID(ctx, orderId)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	// 如果订单不存在，则直接返回
	if order == nil || order.ID == "" {
		return nil
	}
	// 如果订单状态不为已预约，则直接返回
	if order.Status != constant.OrderStatusSuccess.String() {
		return nil
	}
	// 查询订单商品预约信息
	courseAppointment, err := s.courseAppointmentRepo.FindMultiCacheByOrderID(ctx, orderId)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	// 过滤已完成的预约信息
	courseAppointment = lo.Filter(courseAppointment, func(item *yanxue_model.CourseAppointment, _ int) bool {
		return item.Status == constant.CourseAppointmentStatusSuccess.String() || item.Status == constant.CourseAppointmentStatusCompleted.String()
	})
	// 如果预约信息存在，则直接返回
	if len(courseAppointment) > 0 {
		return nil
	}
	// 更新订单状态为待预约
	oldOrder := s.orderRepo.DeepCopy(order)
	order.Status = constant.OrderStatusPending.String()
	err = s.orderRepo.UpdateOneCacheWithZero(ctx, order, oldOrder)
	if err != nil {
		return errorx.DataSQLErr.WithError(err).Err()
	}
	return nil
}
