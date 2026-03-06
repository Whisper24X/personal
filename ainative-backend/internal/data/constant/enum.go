package constant

//go install github.com/abice/go-enum@latest

//go:generate go-enum --marshal --names --values --ptr --nocomments --flag --output-suffix .gen

// Status 常状态 ENUM(delete=-1,disable=0,enable=1)
type Status int32

// SysStatus 常状态 ENUM(disable=-1,enable=1)
type SysStatus int32

// TeachingNodeMastery 知识点掌握情况
/*ENUM(
notMastered // 未掌握
weak // 薄弱
basic // 基本掌握
flexible // 灵活掌握
)*/
type TeachingNodeMastery string

// SysRoleDataPermissionType
/*ENUM(
all // 全部数据
deptAndBelow // 本部门及以下数据
dept // 本部门数据
self // 仅本人数据
)*/
type SysRoleDataPermissionType string

// SysDeptType 部门类型 公司:company 区域:area 门店:store
/*ENUM(
root // 根节点
child // 子节点
leaf // 叶子节点
)*/
type SysDeptType string

// StudyRoomInfoStatus 自习室状态
/*ENUM(
enable=1 // 启用
disable=-1 // 禁用
)*/
type StudyRoomInfoStatus int32

// StudyRoomBannerStatus 自习室banner状态
/*ENUM(
enable=1 // 启用
disable=-1 // 禁用
)*/
type StudyRoomBannerStatus int32

// StudyRoomAppointmentType 预约类型
/*ENUM(
fixed // 固定预约
flexible // 灵活预约
)*/
type StudyRoomAppointmentType string

// StudyRoomAppointmentStatus 预约状态 -2 申请变更 -1预约取消 1预约成功 2 签到成功 3 离店成功
/*ENUM(
change=-2 	//申请变更
cancel=-1 	//预约取消
success=1 	//预约成功
checkIn=2 	//签到成功
leave=3 	//离店成功
)*/
type StudyRoomAppointmentStatus int32

// StudyRoomAreaStatus 自习室区域状态
/*ENUM(
enable=1 	//启用
disable=-1 	//禁用
)*/
type StudyRoomAreaStatus int32

// XcxUserMessageCategory 小程序消息分类
/*ENUM(
studyRoomAppointment // 自习室预约
)*/
type XcxUserMessageCategory string

// XcxUserMessageType 小程序消息类型
/*ENUM(
appointmentReminder // 自习室预约提醒
signInReminder // 自习室签到提醒
leaveReminder // 自习室离店提醒
appointmentChangeReminder // 自习室预约变更提醒
)*/
type XcxUserMessageType string

// StudyRoomAppointmentUserType 预约用户类型
/*ENUM(
user // 用户
admin // 管理员
)*/
type StudyRoomAppointmentUserType string

// StatsType 统计类型
/*ENUM(
appointmentRate // 每日预约率
attendanceRate // 每日出勤率
)*/
type StatsType string

// CourseStatus 课程状态 下架 上架
/*ENUM(
putOff // 下架
putOn // 上架
)*/
type CourseStatus int32

// CourseStockStatus 课程库存状态
/*ENUM(
putOff // 下架
putOn // 上架
)*/
type CourseStockStatus string

// CourseAppointmentStatus 课程预约状态
/*ENUM(
cancel // 取消预约
success // 已预约
completed // 已完成
)*/
type CourseAppointmentStatus string

// 商品状态
/*ENUM(
putOff // 下架
putOn // 上架
pending // 待上架
delete // 删除
)*/
type GoodStatus string

// 订单状态 待预约 已预约 已完成 已退款 交易关闭 待付款 退款中 退款失败 部分退款
/*ENUM(
pending // 待预约
success // 已预约
completed // 已完成
refunded // 已退款
closed // 交易关闭
pendingPayment // 待付款
refunding // 退款中
failedRefund // 退款失败
partialRefunded // 部分退款
)*/
type OrderStatus string

// ParentAccompany 家长是否陪同
/*ENUM(
yes // 是
no // 否
unknown // 不确定
)*/
type ParentAccompany string

/*
ENUM(
M // 男
F // 女
)
*/
type StudentSex string

/*
ENUM(
disable=-1 // 禁用
enable=1 // 启用
)
*/
type UserStatus int32

// 商品类型 单日类型商品 多日类型商品 定金商品
/*ENUM(
single // 单日类型商品
multi // 多日类型商品
deposit // 定金商品
)*/
type GoodType string

// 课程类型 单日类型商品 多日类型商品
/*ENUM(
single // 单日类型商品
multi // 多日类型商品
)*/
type CourseType string

// CouponStatus 优惠券状态 下架 上架
/*ENUM(
putOff // 下架
putOn // 上架
)*/
type CouponStatus string

// CouponPushType 优惠券推送类型
/*ENUM(
public // 公开
private // 私密
)*/
type CouponPushType string

// CouponType 优惠券类型
/*ENUM(
common // 通用类型
good // 商品类型
)*/
type CouponType string

// UserCouponStatus 优惠券类型
/*ENUM(
unUsed // 未核销
used // 已核销
expired // 已过期
locked // 已锁定
)*/
type UserCouponStatus string
