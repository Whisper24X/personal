<template>
  <view v-if="showIndicator" class="env-indicator" @tap="handleSwitchEnv">
    {{ envName }}
  </view>
</template>

<script>
import { computed, ref } from "vue"
import { CURRENT_ENV, IS_PROD, IS_DEV } from "../config/env"
import { switchEnv } from "../utils/switchEnv"

export default {
  name: "EnvIndicator",
  setup() {
    // 是否显示环境指示器（仅在非生产环境下显示）
    const showIndicator = computed(() => {
      return IS_DEV || !IS_PROD
    })

    // 环境名称
    const envName = computed(() => {
      const envMap = {
        development: "开发",
        test: "测试",
        stage: "预发",
        production: "生产"
      }
      return envMap[CURRENT_ENV] || CURRENT_ENV
    })

    // 切换环境
    const handleSwitchEnv = () => {
      if (IS_DEV) {
        switchEnv()
      }
    }

    return {
      showIndicator,
      envName,
      handleSwitchEnv
    }
  }
}
</script>

<style>
.env-indicator {
  position: fixed;
  top: 80px;
  right: 0;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px 0 0 4px;
  z-index: 9999;
}
</style>
