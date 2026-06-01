<template>
  <div class="common">
    <el-container>
      <el-aside width="210px" class="sider">
        <div class="logo">
          <a href="/">
            <img src="../../assets/ycmath.png" class="img" alt="" />
            <div>
              洋葱研学
              <strong v-if="envConfig.env !== 'production'" :class="envConfig.env === 'production'
                ? 'control-env-prod'
                : 'control-env-test'
                ">{{ envConfig.envName }}
              </strong>
            </div>
          </a>
        </div>
        <el-menu :default-active="activeMenu" active-text-color="#fff" text-color="#ffffffa6" background-color="#001529"
          class="el-menu-vertical-demo" @select="handleSelect">
          <template v-for="item in visibleMenuOptions" :key="item.name">
            <el-sub-menu v-if="hasChildren(item)" :index="item.name" v-memo="[item.name, item.meta?.title]">
              <template #title>
                <span>{{ item.meta?.title }}</span>
              </template>
              <el-menu-item v-for="subItem in getVisibleChildren(item)" :key="subItem.name" :index="subItem.name"
                v-memo="[subItem.name, subItem.meta?.title]">
                {{ subItem.meta?.title }}
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item v-else :index="item.name" v-memo="[item.name, item.meta?.title]">
              <span>{{ item.meta?.title }}</span>
            </el-menu-item>
          </template>
        </el-menu>
      </el-aside>
      <el-container class="main-container">
        <el-header class="header">
          <div class="breadcrumb">
            <NotificationPopover v-if="false" />
            <el-popover placement="bottom" :width="100" trigger="hover" popper-class="user-popover">
              <template #reference>
                <span class="username">{{ userStore.info?.nickname }}</span>
              </template>
              <div class="popover-content">
                <div class="menu-item" @click="handleChangePassword">
                  <el-icon>
                    <EditPen />
                  </el-icon>
                  修改密码
                </div>
                <div class="menu-item" @click="handleChangeDept" v-if="false">
                  <el-icon>
                    <Switch />
                  </el-icon>
                  组织切换
                </div>
                <div class="menu-item" @click="handleLogout">
                  <el-icon>
                    <SwitchButton />
                  </el-icon>
                  退出登录
                </div>
              </div>
            </el-popover>
          </div>
        </el-header>
        <el-main class="content">
          <router-view></router-view>
        </el-main>
      </el-container>
    </el-container>

    <!-- 修改密码弹窗 -->
    <ChangePasswordDialog v-model="showPasswordDialog" :is-force-change="isForceChange"
      @success="handlePasswordChangeSuccess" />

    <!-- 添加部门选择弹窗 -->
    <DeptSelectDialog v-model="showDeptDialog" @success="handleDeptChangeSuccess" />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, shallowRef, watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/modules/userStore'
import { EditPen, SwitchButton, Switch } from '@element-plus/icons-vue'
import NotificationPopover from '@/components/NotificationPopover/index.vue'
import ChangePasswordDialog from '@/components/ChangePasswordDialog/index.vue'
import DeptSelectDialog from '@/components/DeptSelectDialog/index.vue'
import type { RouteRecordRaw } from 'vue-router'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const ENV = process.env.ENV

const envConfig = shallowRef({
  env: ENV,
  envName:
    ENV === 'production'
      ? '正式环境'
      : ENV === 'stage'
        ? '预发布环境'
        : '测试环境',
})

// 使用 useMemo 缓存过滤结果，只有当 menus 变化时才重新计算
const visibleMenuOptions = computed(() => {
  return filterHiddenRoutes(JSON.parse(JSON.stringify(userStore.menus)))
})

// 使用 Map 缓存子菜单过滤结果
const childrenCache = new Map<string, RouteRecordRaw[]>()

// 获取可见的子菜单，添加缓存
const getVisibleChildren = (item: RouteRecordRaw) => {
  if (!item.children) return []

  // 使用路由名称作为缓存键
  const cacheKey = item.name as string
  if (childrenCache.has(cacheKey)) {
    return childrenCache.get(cacheKey)!
  }

  const visibleChildren = item.children.filter((child) => !child.meta?.hidden)
  childrenCache.set(cacheKey, visibleChildren)
  return visibleChildren
}

// 优化递归过滤函数
const filterHiddenRoutes = (routes: RouteRecordRaw[]) => {
  return routes.filter((route) => {
    // 如果当前路由是隐藏的，直接过滤掉
    if (route.meta?.hidden) return false

    // 如果有子路由，递归过滤
    if (route.children?.length) {
      const filteredChildren = filterHiddenRoutes(route.children)
      // 直接修改原数组，避免创建新数组
      route.children.length = 0
      route.children.push(...filteredChildren)
      // 如果过滤后没有可见的子路由，且当前路由没有组件，也过滤掉
      if (filteredChildren.length === 0 && !route.component) return false
    }

    return true
  })
}

// 清除缓存的函数
const clearMenuCache = () => {
  childrenCache.clear()
}

// 在路由变化时清除缓存
watch(
  () => userStore.menus,
  () => {
    clearMenuCache()
  },
  { deep: false },
)

// 在组件卸载时清除缓存
onUnmounted(() => {
  clearMenuCache()
})

// 判断是否有可见的子菜单
const hasChildren = (item: RouteRecordRaw) => {
  return item.children && getVisibleChildren(item).length > 0
}

// 计算当前激活的菜单项
const activeMenu = computed(() => {
  // 如果当前路由设置了 activeMenu，则使用
  if (route.meta?.activeMenu) {
    return route.meta.activeMenu
  }
  // 否则使用当前路由名称
  return route.name
})

const handleSelect = (index: string, indexPath: any[], item: any, component: any) => {
  console.log(index, indexPath, item, component)

  // TODO：这里后续需要转换为path的方式调整路由，name的方式在各别机器上存在特殊异常
  router.push({
    name: index,
  })
}

// 密码修改相关
const showPasswordDialog = ref(false)
const isForceChange = ref(false)

// 检查是否需要强制修改密码
onMounted(() => {
  console.log(`密码修改${userStore.info?.isChangePwd}`)
  if (userStore.info?.isChangePwd === false) {
    isForceChange.value = true
    showPasswordDialog.value = true
  }
})

// 处理修改密码
const handleChangePassword = () => {
  showPasswordDialog.value = true
}

// 密码修改成功回调
const handlePasswordChangeSuccess = () => {
  isForceChange.value = false
}

// 处理退出登录
const handleLogout = async () => {
  try {
    await userStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('退出登录失败:', error)
  }
}

// 部门切换相关
const showDeptDialog = ref(false)

const handleChangeDept = () => {
  showDeptDialog.value = true
}

const handleDeptChangeSuccess = () => {
  // 切换成功后刷新页面保证权限是最新的
  window.location.reload()
}
</script>
<style scoped lang="scss">
.sider {
  min-height: 100vh;
  background-color: #001529;

  color: #fff;

  .logo {
    a {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 64px;
      font-weight: bold;
      font-size: 16px;
      color: #fff;
    }

    .img {
      display: block;
      width: 34px;
      margin-right: 10px;
    }

    strong {
      display: block;
    }
  }

  .control-env-test {
    color: #f00;
    font-size: 20px;
    text-align: center;
  }

  .control-env-prod {
    position: absolute;
    top: 40px;
    left: 78px;
    color: #fff;
    font-size: 18px;
    text-align: center;
  }

  :deep(.el-menu) {
    background-color: #001529;

    .el-menu-item {
      &:hover {
        color: #fff;
      }

      &.is-active {
        background-color: var(--el-color-primary);
      }
    }
  }
}

.header {
  border-bottom: 1px solid #eee;
  height: 64px;
  background: #fff;
  display: flex;
  justify-content: flex-end;
  align-items: center;

  .breadcrumb {
    text-align: right;
    display: flex;
    align-items: center;
    gap: 16px;

    .username {
      cursor: pointer;
      padding: 0 10px;

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }
}

.main-container {
  .content {
    background-color: rgb(240, 242, 245);
    height: calc(100vh - 64px);
    overflow-x: hidden;

    // 自定义滚动条样式
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 3px;

      // 鼠标悬停时加深颜色
      &:hover {
        background-color: rgba(0, 0, 0, 0.4);
      }
    }

    // 默认隐藏滚动条
    &::-webkit-scrollbar-thumb {
      visibility: hidden;
    }

    // 滚动时显示滚动条
    &:hover::-webkit-scrollbar-thumb,
    &:active::-webkit-scrollbar-thumb {
      visibility: visible;
    }

    // Firefox 滚动条样式
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;

    // IE/Edge 滚动条样式
    -ms-overflow-style: -ms-autohiding-scrollbar;
  }
}

.breadcrumb {
  text-align: right;
  display: flex;
  align-items: center;
  gap: 16px;

  .username {
    cursor: pointer;
    padding: 0 10px;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

.el-dialog {
  .el-form {
    padding: 20px;
  }
}
</style>

<style lang="scss">
.user-popover {
  padding: 0;
  color: red;

  .popover-content {
    .menu-item {
      padding: 10px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #606266;
      transition: all 0.3s;

      &:not(:last-child) {
        border-bottom: 1px solid #f0f0f0;
      }

      .el-icon {
        font-size: 16px;
        color: #909399;
        transition: all 0.3s;
      }

      &:hover {
        background-color: #f6f8ff;
        color: var(--el-color-primary);

        .el-icon {
          color: var(--el-color-primary);
        }
      }

      &:last-child {
        &:hover {
          background-color: #fff0f0;
          color: #f56c6c;

          .el-icon {
            color: #f56c6c;
          }
        }
      }
    }
  }
}
</style>
