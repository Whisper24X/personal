<template>
  <Exception
    type="403"
    code="403"
    message="抱歉，您没有访问该页面的权限"
  >
    <template #actions>
      <el-button type="primary" @click="goHome">返回首页</el-button>
      <el-button @click="goBack">返回上一页</el-button>
    </template>
  </Exception>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import Exception from './components/Exception.vue';

const router = useRouter();

const goHome = () => {
  router.push('/');
};

const goBack = () => {
  router.back();
};
</script> 