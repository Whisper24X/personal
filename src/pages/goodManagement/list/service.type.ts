// 平台商品列表请求
export interface GetPlatformGoodListReq {
  name?: string
  page: number
  pageSize: number
}

// 平台商品信息
export interface PlatformGoodInfo {
  id: string
  name: string
  goodType: 'single' | 'multi'
  sales: number
  createdAt: string
  updatedAt: string
  updatedByName: string
}

// 平台商品列表响应
export interface GetPlatformGoodListReply {
  total: number
  list: PlatformGoodInfo[]
}

// 创建平台商品请求
export interface CreatePlatformGoodReq {
  name: string
  goodType: 'single' | 'multi'
}

// 创建平台商品响应
export interface CreatePlatformGoodReply {
  id: string
}

// 更新平台商品请求
export interface UpdatePlatformGoodReq {
  id: string
  name?: string
}
// 更新平台商品响应
export interface UpdatePlatformGoodReply {}

// 渠道信息
export interface ChannelInfo {
  id: string
  name: string
}

// 渠道列表响应
export interface GetChannelListReply {
  list: ChannelInfo[]
}
