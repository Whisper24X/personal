package biz

import (
	"context"

	"gitlab.yc345.tv/backend/orm-gen/v2/condition"

	pb "gitlab.yc345.tv/backend/yanxue/api/shadow/v1"
	"gitlab.yc345.tv/backend/yanxue/internal/data/gorm/yanxue_model"
)

// RefreshGoodType 刷新商品类型（异步执行）
func (s *ShadowV1OrderUseCase) RefreshGoodType(ctx context.Context, req *pb.RefreshGoodTypeReq) (*pb.RefreshGoodTypeReply, error) {
	resp := &pb.RefreshGoodTypeReply{}

	// 异步执行处理逻辑，避免接口超时
	go func() {
		// 使用 context.Background() 创建新的上下文，避免使用已超时的请求上下文
		bgCtx := context.Background()

		s.log.Infof("RefreshGoodType: 开始异步处理商品类型刷新任务")

		// 1. 查询需要刷新商品类型的订单
		orders, err := s.findOrdersToRefreshGoodType(bgCtx)
		if err != nil {
			s.log.Errorf("RefreshGoodType: 查询订单失败, err=%v", err)
			return
		}

		s.log.Infof("RefreshGoodType: 找到 %d 个需要刷新商品类型的订单", len(orders))

		if len(orders) == 0 {
			s.log.Infof("RefreshGoodType: 没有需要刷新的订单")
			return
		}

		// 2. 收集所有需要查询的商品ID（order.goodId）
		goodIdSet := make(map[string]bool)
		for _, order := range orders {
			if order.GoodID != "" {
				goodIdSet[order.GoodID] = true
			}
		}

		// 转换为切片
		var goodIds []string
		for goodId := range goodIdSet {
			goodIds = append(goodIds, goodId)
		}

		s.log.Infof("RefreshGoodType: 需要查询 %d 个商品", len(goodIds))

		// 3. 通过 goodId 查询 good 表，获取 platformGoodId
		goods, err := s.goodRepo.FindMultiCacheByIDS(bgCtx, goodIds)
		if err != nil {
			s.log.Errorf("RefreshGoodType: 查询 good 表失败, err=%v", err)
			return
		}

		s.log.Infof("RefreshGoodType: 成功查询到 %d 个 good 记录", len(goods))

		// 4. 构建 goodId -> platformGoodId 映射
		goodIdToPlatformGoodIdMap := make(map[string]string)
		platformGoodIdSet := make(map[string]bool)
		for _, good := range goods {
			if good.PlatformGoodID != "" {
				goodIdToPlatformGoodIdMap[good.ID] = good.PlatformGoodID
				platformGoodIdSet[good.PlatformGoodID] = true
			}
		}

		// 转换为切片
		var platformGoodIds []string
		for platformGoodId := range platformGoodIdSet {
			platformGoodIds = append(platformGoodIds, platformGoodId)
		}

		s.log.Infof("RefreshGoodType: 需要查询 %d 个平台商品的类型", len(platformGoodIds))

		// 5. 通过 platformGoodId 查询 platform_good 表，获取 goodType
		platformGoods, err := s.platformGoodRepo.FindMultiCacheByIDS(bgCtx, platformGoodIds)
		if err != nil {
			s.log.Errorf("RefreshGoodType: 查询 platform_good 表失败, err=%v", err)
			return
		}

		s.log.Infof("RefreshGoodType: 成功查询到 %d 个 platform_good 记录", len(platformGoods))

		// 6. 构建 platformGoodId -> goodType 映射
		platformGoodIdToTypeMap := make(map[string]string)
		for _, platformGood := range platformGoods {
			if platformGood.GoodType != "" {
				platformGoodIdToTypeMap[platformGood.ID] = platformGood.GoodType
			}
		}

		// 7. 构建最终的 goodId -> goodType 映射
		goodIdToTypeMap := make(map[string]string)
		for goodId, platformGoodId := range goodIdToPlatformGoodIdMap {
			if goodType, exists := platformGoodIdToTypeMap[platformGoodId]; exists {
				goodIdToTypeMap[goodId] = goodType
			}
		}

		s.log.Infof("RefreshGoodType: 成功构建 %d 个商品的类型映射", len(goodIdToTypeMap))

		successCount := 0
		failCount := 0

		// 8. 遍历每个订单，更新商品类型
		for _, order := range orders {
			goodType, exists := goodIdToTypeMap[order.GoodID]
			if !exists || goodType == "" {
				s.log.Warnf("RefreshGoodType: 商品类型不存在, orderId=%s, goodId=%s", order.ID, order.GoodID)
				failCount++
				continue
			}

			// 更新订单的商品类型
			oldOrder := s.orderRepo.DeepCopy(order)
			order.GoodType = goodType

			err := s.orderRepo.UpdateOneCache(bgCtx, order, oldOrder)
			if err != nil {
				s.log.Errorf("RefreshGoodType: 更新订单商品类型失败, orderId=%s, err=%v", order.ID, err)
				failCount++
				continue
			}

			successCount++
			s.log.Infof("RefreshGoodType: 订单商品类型更新成功, orderId=%s, goodType=%s", order.ID, goodType)
		}

		s.log.Infof("RefreshGoodType: 异步处理完成, 总数=%d, 成功=%d, 失败=%d",
			len(orders), successCount, failCount)
	}()

	// 立即返回，告知任务已启动
	resp.TotalCount = 0
	resp.SuccessCount = 0
	resp.FailCount = 0

	s.log.Infof("RefreshGoodType: 任务已启动，正在后台异步执行")

	return resp, nil
}

// findOrdersToRefreshGoodType 查询需要刷新商品类型的订单
func (s *ShadowV1OrderUseCase) findOrdersToRefreshGoodType(ctx context.Context) ([]*yanxue_model.Order, error) {
	// 构建查询条件
	req := &condition.Req{
		Page:     1,
		PageSize: 10000, // 设置一个较大的值，确保能查询到所有订单
		Query:    []*condition.QueryParam{},
	}

	// 查询所有订单
	allOrders, _, err := s.orderRepo.FindMultiByCondition(ctx, req)
	if err != nil {
		return nil, err
	}

	// 过滤出需要刷新商品类型的订单（goodType 为空）
	var ordersToRefresh []*yanxue_model.Order
	for _, order := range allOrders {
		// 如果 goodType 为空，则需要刷新
		if order.GoodType == "" {
			ordersToRefresh = append(ordersToRefresh, order)
		}
	}

	return ordersToRefresh, nil
}
