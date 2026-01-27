// 优惠券状态枚举
export enum CouponStatus {
  UNUSED = "unUsed", // 可用
  USED = "used", // 已使用
  EXPIRED = "expired", // 已过期
  LOCKED = "locked" // 已锁定
}

// 优惠券类型枚举
export enum CouponType {
  COMMON = "common", // 通用券
  GOOD = "good" // 商品券
}
// 优惠券状态配置
export const COUPON_STATUS_CONFIG = {
  [CouponStatus.UNUSED]: {
    label: "未核销",
    color: "#52c41a",
    buttonText: "未核销"
  },
  [CouponStatus.USED]: {
    label: "已核销",
    color: "#999999",
    buttonText: "已核销"
  },
  [CouponStatus.EXPIRED]: {
    label: "已过期",
    color: "#ff4d4f",
    buttonText: "已过期"
  },
  [CouponStatus.LOCKED]: {
    label: "已锁定",
    color: "#999999",
    buttonText: "已锁定"
  }
}
// 优惠券类型配置
export const COUPON_TYPE_CONFIG = {
  [CouponType.COMMON]: {
    label: "通用券",
    color: "#ff6b9d",
    gradient: "linear-gradient(135deg, #ff6b9d 0%, #ff8fab 100%)"
  },
  [CouponType.GOOD]: {
    label: "商品券",
    color: "#4facfe",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
  }
}
// 标签页配置
export const TAB_CONFIG = [
  { key: CouponType.COMMON, label: "通用券" },
  { key: CouponType.GOOD, label: "商品券" }
]
