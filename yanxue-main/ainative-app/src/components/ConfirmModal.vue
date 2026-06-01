<template>
  <view v-if="visible" class="confirm-modal">
    <view class="modal-mask"></view>
    <view class="modal-container">
      <view class="modal-content">
        <view class="modal-title">{{ title }}</view>
        <view class="modal-buttons">
          <view class="cancel-btn" @tap="handleCancel">
            {{ cancelText }}
          </view>
          <view class="confirm-btn" @tap="handleConfirm">
            {{ confirmText }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: "ConfirmModal",
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: "确认操作"
    },
    confirmText: {
      type: String,
      default: "是"
    },
    cancelText: {
      type: String,
      default: "否"
    }
  },
  emits: ["confirm", "cancel"],
  setup(props, { emit }) {
    const handleConfirm = () => {
      emit("confirm")
    }

    const handleCancel = () => {
      emit("cancel")
    }

    return {
      handleConfirm,
      handleCancel
    }
  }
}
</script>

<style lang="less">
.confirm-modal {
  .modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 999;
  }

  .modal-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(100% - 96px);
    border-radius: 16px;
    background: #ffffff;
    overflow: hidden;
    z-index: 1000;
  }

  .modal-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px;
    position: relative;
    &::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 140px;
      height: 322px;
      background: url("https://fp.yangcong345.com/middle/1.0.0/modal-bg__w.png") no-repeat center
        center;
      background-size: 100% 100%;
    }
  }

  .modal-title {
    margin: 52px 0;
    font-family: "苹方-简";
    font-size: 34px;
    font-weight: normal;
    line-height: 52px;
    text-align: center;
    letter-spacing: normal;
    /* 黑白灰/黑色393548 */
    color: #393548;
  }

  .modal-buttons {
    display: flex;
    width: 100%;
    justify-content: center;
    gap: 32px;
    font-family: PingFang SC;
    font-size: 32px;
    font-weight: 600;
    line-height: 32px;
    letter-spacing: normal;
    /* 黑白灰/黑色393548 */
    color: #393548;

    .cancel-btn {
      border-radius: 315px;
      box-sizing: border-box;
      border: 2px solid #b8b4c7;
      width: 220px;
      height: 72px;
      /* 自动布局 */
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .confirm-btn {
      position: relative;
      width: 220px;
      height: 72px;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 315px;
      background: #ffd633;
      box-shadow: inset 0px 2px 2px 0px rgba(255, 255, 255, 0.302);
      &::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        background: url("https://fp.yangcong345.com/middle/1.0.0/btn-bg__w.png") no-repeat center
          center;
        background-size: 100% 100%;
        opacity: 0.3;
        width: 50px;
        height: 72px;
      }
    }
  }
}
</style>
