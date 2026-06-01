# Composable（组合式函数）规范

跨页面复用的逻辑应提取为 Composable，放在 `src/composables/` 目录。

## 命名规范

- **文件命名**：`use<功能>.ts`（camelCase）
- **函数命名**：`use<功能>`，与文件名一致

## 示例：`useOrderPayment`

```ts
// src/composables/useOrderPayment.ts
import { ref, computed, type Ref } from 'vue';

export function useOrderPayment(goodId: string, goodInfo: Ref<GoodInfo>) {
  // 响应式状态
  const paymentMethod = ref<'wechat' | 'deposit'>('wechat');
  const depositBalance = ref(0);

  // 计算属性
  const finalPrice = computed(() => {
    const price = goodInfo.value?.price ?? 0;
    return paymentMethod.value === 'deposit' ? Math.min(price, depositBalance.value) : price;
  });

  // 方法
  const loadDepositBalance = async () => {
    const res = await getDepositBalance();
    depositBalance.value = res.balance;
  };

  const performPayment = async (orderId: string) => {
    try {
      if (paymentMethod.value === 'wechat') {
        await payByWechat(orderId);
      } else {
        await payByDeposit(orderId);
      }
    } catch (e) {
      Taro.showToast({ title: '支付失败', icon: 'none' });
      throw e;
    }
  };

  // 统一返回所有状态和方法
  return {
    paymentMethod,
    depositBalance,
    finalPrice,
    loadDepositBalance,
    performPayment,
  };
}
```

## 使用方式

```vue
<script setup lang="ts">
import { useOrderPayment } from "@/composables/useOrderPayment"

const goodInfo = ref<GoodInfo>({ ... })
const { paymentMethod, finalPrice, performPayment } = useOrderPayment(
  props.goodId,
  goodInfo
)
</script>
```

## 最佳实践

- **只负责逻辑**：Composable 不依赖 DOM/模板，纯逻辑复用
- **只读包装**：对外暴露的 ref 若不希望外部修改，可用 `readonly()` 包装
- **统一错误处理**：异步操作统一 try/catch + `Taro.showToast` 提示
