export default {
  pages: [
    "pages/recommend/index/index", // 首页
    "pages/recommend/category/index", // 分类页面
    "pages/discover/index/index", // 发现页面
    "pages/discover/strategies/index", // 精选攻略
    "pages/discover/vlogs/index", // 精彩VLOG
    "pages/discover/moments/index", // 精彩瞬间
    "pages/appointment/list/index", // 预约页面
    "pages/user/login/index", // 登录页面
    "pages/user/profile/index", // 我的页面
    "pages/webview/index", // webview 页面
    "pages/product/detail/index", // 商品详情
    "pages/user/familyInfo/childInfo/index", // 营员信息列表
    "pages/user/familyInfo/childInfo/form", // 添加/编辑营员信息
    "pages/user/familyInfo/parentInfo/index", // 监护人信息列表
    "pages/user/familyInfo/parentInfo/form", // 添加/编辑监护人信息
    "pages/appointment/index/index", // 课程预约
    "pages/appointment/records/index", // 预约记录
    "pages/user/evaluation/index", // 课程评价
    "pages/user/agreement/index", // 用户协议
    "pages/user/settings/index", // 用户设置
    "pages/coupon/list/index", // 我的优惠券
    "pages/coupon/receiveList/index", // 优惠券列表（领取）
    "pages/coupon/products/index", // 优惠券商品
    "pages/coupon/available/index", // 可用优惠券
    "pages/order/list/index", // 我的订单
    "pages/order/submit/index", // 提交订单
    "pages/order/confirm/index", // 确认订单
    "pages/order/confirm-no-appointment/index", // 无预约确认订单
    "pages/order/pending-payment/index", // 待付款
    "pages/order/transaction-closed/index", // 交易关闭
    "pages/order/payment-success/index", // 支付成功
    "pages/order/pending-appointment/index", // 待预约
    "pages/order/appointed/index", // 已预约
    "pages/order/completed/index", // 已完成
    "pages/order/refunded/index", // 已退款
    "pages/order/refunding/index", // 退款中
    "pages/order/appointment-abnormal/index", // 预约异常页面
    "pages/poster/test/index" // PosterGenerator 测试页面
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#fff",

    navigationBarTitleText: "洋葱星球研学",
    navigationStyle: "custom",
    navigationBarTextStyle: "white"
  },
  tabBar: {
    custom: true,
    list: [
      {
        pagePath: "pages/recommend/index/index",
        text: "首页"
      },
      {
        pagePath: "pages/discover/index/index",
        text: "发现"
      },
      {
        pagePath: "pages/appointment/list/index",
        text: "预约"
      },
      {
        pagePath: "pages/user/profile/index",
        text: "我的"
      }
    ]
  },
  requiredPrivateInfos: []
}
