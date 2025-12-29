<template>
  <el-container id="app" class="min-h-screen">
    <el-header class="header-container">
      <div class="header-content">
        <div class="logo-section">
          <router-link to="/" class="logo-link">
            <el-icon :size="28" color="#409EFF">
              <Promotion />
            </el-icon>
            <span class="logo-text">Mind2Build</span>
            <el-tag size="small" type="info" effect="plain">即思即成</el-tag>
          </router-link>
        </div>
        <el-menu mode="horizontal" :ellipsis="false" class="header-menu" router>
          <el-menu-item index="/">
            <el-icon>
              <Monitor />
            </el-icon>
            控制面板
          </el-menu-item>
          <el-menu-item index="/config/llm">
            <el-icon>
              <Setting />
            </el-icon>
            LLM 配置
          </el-menu-item>
        </el-menu>
      </div>
    </el-header>

    <el-main>
      <div class="main-content">
        <router-view />
      </div>
    </el-main>

    <el-footer class="footer">
      <p class="footer-text">
        <el-icon>
          <MagicStick />
        </el-icon>
        Mind2Build - AI 多智能体协作框架
      </p>
    </el-footer>
  </el-container>
</template>

<script setup lang="ts">
import { Promotion, Monitor, Plus, MagicStick, Setting } from '@element-plus/icons-vue';
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}

#app {
  min-height: 100vh;
}

.header-container {
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  padding: 0 !important;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.logo-section {
  display: flex;
  align-items: center;
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}

.logo-text {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
}

.header-menu {
  border-bottom: none;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.footer {
  background-color: #fff;
  border-top: 1px solid #eee;
  text-align: center;
}

.footer-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #909399;
  margin: 0;
}

.el-main {
  background-color: #f5f7fa;
  min-height: calc(100vh - 120px);
}
</style>
