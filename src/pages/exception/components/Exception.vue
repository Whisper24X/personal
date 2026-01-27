<template>
  <div class="exception">
    <div class="exception__content">
      <div class="exception__animation">
        <div class="number" v-if="props.code">{{ props.code.charAt(0) }}</div>
        <div class="illustration">
          <div class="circle"></div>
          <div class="clip">
            <div class="paper">
              <div class="face">
                <div class="eyes">
                  <div class="eye eye-left"></div>
                  <div class="eye eye-right"></div>
                </div>
                <div class="rosyCheeks rosyCheeks-left"></div>
                <div class="rosyCheeks rosyCheeks-right"></div>
                <div class="mouth" :class="{ sad: props.type === '403' }"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="number" v-if="props.code">{{ props.code.charAt(props.code.length - 1) }}</div>
      </div>
      <div class="exception__message">{{ props.message }}</div>
      <div class="exception__actions">
        <slot name="actions">
          <el-button type="primary" @click="goHome">返回首页</el-button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 异常页面基础组件
 */
import { useRouter } from 'vue-router';

interface Props {
  type: '403' | '404';  // 异常类型
  code: string;         // 错误码
  message: string;      // 错误信息
}

const props = withDefaults(defineProps<Props>(), {
  type: '404',
  code: '404',
  message: '哎呀！页面走丢了'
});

const router = useRouter();

const goHome = () => {
  router.push('/');
};
</script>

<style lang="scss" scoped>
.exception {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;

  &__content {
    text-align: center;
  }

  &__animation {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 40px;

    .number {
      font-size: 150px;
      font-weight: bold;
      color: #409eff;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
      animation: bounce 2s infinite;
    }

    .illustration {
      width: 140px;
      height: 140px;
      margin: 0 20px;
      position: relative;
      animation: float 3s ease-in-out infinite;
    }

    .circle {
      position: absolute;
      width: 140px;
      height: 140px;
      background-color: #409eff;
      border-radius: 50%;
    }

    .clip {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 120px;
      height: 120px;
      overflow: hidden;
    }

    .paper {
      width: 100%;
      height: 100%;
      background-color: white;
      border-radius: 50%;
      position: relative;
    }

    .face {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
    }

    .eyes {
      display: flex;
      justify-content: space-between;
      width: 50px;
      margin: 0 auto;
      padding-top: 20px;

      .eye {
        width: 12px;
        height: 12px;
        background-color: #409eff;
        border-radius: 50%;
        animation: blink 3s ease-in-out infinite;
      }
    }

    .rosyCheeks {
      position: absolute;
      width: 12px;
      height: 8px;
      background-color: #ffb3b3;
      border-radius: 50%;
      top: 35px;

      &-left {
        left: 10px;
      }

      &-right {
        right: 10px;
      }
    }

    .mouth {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 8px;
      border: 3px solid #409eff;
      border-radius: 0 0 20px 20px;
      border-top: 0;

      &.sad {
        transform: translateX(-50%) rotate(180deg);
        bottom: 35px;
      }
    }
  }

  &__message {
    font-size: 24px;
    color: #606266;
    margin: 24px 0 32px;
    animation: fadeIn 1s ease-in;
  }

  &__actions {
    .el-button {
      margin: 0 8px;
      animation: slideUp 0.5s ease-out forwards;
      opacity: 0;

      &:first-child {
        animation-delay: 0.2s;
      }

      &:last-child {
        animation-delay: 0.4s;
      }
    }
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
}

@keyframes blink {
  0%, 100% {
    transform: scale(1);
  }
  10% {
    transform: scale(1, 0.1);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style> 