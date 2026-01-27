<template>
  <view class="login-container">
    <!-- 使用状态栏组件 -->
    <status-bar />

    <!-- 顶部图标和标题 -->
    <view class="header">
      <image
        class="logo"
        src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/logo__w.png"
        mode="widthFix"
      />
    </view>

    <!-- 登录卡片 -->
    <view class="login-card">
      <view class="login-tip">登录以使用更多服务</view>

      <!-- 微信授权登录按钮 - 只在不需要手机号时显示 -->
      <view v-if="!needPhoneLogin" class="quick-login-btn">
        <button v-if="privacyChecked" class="login-button" :loading="loading" @tap="handleWxLogin">
          {{ loading ? "登录中..." : "快捷登录" }}
        </button>
        <button v-else class="login-button disabled" @tap="showPrivacyTip">快捷登录</button>
      </view>

      <!-- 手机号登录表单 - 当需要手机号时显示 -->
      <view v-if="needPhoneLogin" class="phone-login-form">
        <!-- 手机号输入 -->
        <view class="form-item">
          <view class="phone-input">
            <view class="country-code" @tap="showCountryCodePicker">
              +{{ countryCode }}
              <image
                class="arrow"
                src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/down-icon__w.png"
              />
            </view>
            <input
              v-model="phone"
              class="phone-input-item"
              type="number"
              placeholder="请输入手机号"
              maxlength="11"
            />
            <image
              v-if="phone"
              class="clear-btn"
              src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/clear-icon__w.png"
              @tap="clearPhone"
            />
          </view>
        </view>

        <!-- 验证码输入 -->
        <view class="form-item">
          <view class="code-input">
            <input
              v-model="smsCode"
              class="code-input-item"
              type="number"
              placeholder="请输入短信验证码"
              maxlength="4"
            />
            <button
              class="get-code-btn"
              :class="{ disabled: isGettingCode || !isValidPhone }"
              :disabled="isGettingCode || !isValidPhone"
              @tap="getSmsCode"
            >
              {{ codeButtonText }}
            </button>
          </view>
        </view>

        <!-- 手机号登录按钮 -->
        <view class="login-btn-container">
          <button
            class="phone-login-button"
            :class="{ disabled: !canPhoneLogin }"
            :loading="phoneLogging"
            @tap="handlePhoneLogin"
          >
            {{ phoneLogging ? "登录中..." : "登录" }}
          </button>
        </view>
      </view>

      <view class="skip-login" @tap="handleSkipLogin"> 暂不登录 </view>

      <view class="privacy-agreement" @tap="togglePrivacyCheck">
        <view class="check-box">
          <image
            v-if="!privacyChecked"
            src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/uncheck32__w.png"
          />
          <image v-else src="https://fp.yangcong345.com/middle/1.0.0/yanxueImg/check32__w.png" />
        </view>
        <text class="privacy-text">
          我已阅读并同意
          <text class="privacy-text-link" @tap.stop="goToAgreement('user')">《用户协议》</text>、
          <text class="privacy-text-link" @tap.stop="goToAgreement('privacy')">《隐私协议》</text>
          和
          <text class="privacy-text-link" @tap.stop="goToAgreement('children')"
            >《儿童隐私政策》</text
          >
        </text>
      </view>
    </view>
  </view>
</template>

<script>
import { ref, computed } from "vue"
import Taro from "@tarojs/taro"
import { handleXcxLogin, sendSmsCode, phoneLogin } from "@/api/auth"
import { getUserInfo } from "@/api/user"
import StatusBar from "@/components/StatusBar.vue"
import { useUserStore } from "@/store/userStore"

export default {
  name: "Login",
  components: {
    StatusBar
  },
  setup() {
    const userStore = useUserStore()
    const loading = ref(false)
    const privacyChecked = ref(false)
    const needPhoneLogin = ref(false)
    const userWxId = ref("")

    // 获取redirect参数
    const router = Taro.getCurrentInstance().router
    const redirectUrl = router?.params?.redirect || ""

    // 手机号登录相关数据
    const phoneLogging = ref(false)
    const countryCode = ref("86")
    const phone = ref()
    const smsCode = ref()
    const isGettingCode = ref(false)
    const countdown = ref(0)
    const smsCodeId = ref("")
    const hasSentCode = ref(false)

    // 计算属性
    const isValidPhone = computed(() => {
      return /^1[3-9]\d{9}$/.test(phone.value)
    })

    const canPhoneLogin = computed(() => {
      return (
        isValidPhone.value &&
        String(smsCode.value).length === 4 &&
        privacyChecked.value &&
        hasSentCode.value
      )
    })

    const codeButtonText = computed(() => {
      if (countdown.value > 0) {
        return `${countdown.value}秒后重试`
      }
      return hasSentCode.value ? "重新获取" : "获取验证码"
    })

    // 切换用户协议选中状态
    const togglePrivacyCheck = () => {
      privacyChecked.value = !privacyChecked.value
    }

    // 显示隐私协议提示
    const showPrivacyTip = () => {
      Taro.showToast({
        title: "请先阅读并同意用户协议",
        icon: "none"
      })
    }

    // 处理微信登录
    const handleWxLogin = async () => {
      if (!privacyChecked.value) {
        showPrivacyTip()
        return
      }

      if (loading.value) return

      loading.value = true

      try {
        const result = await handleXcxLogin()

        if (result.success) {
          // 登录成功，获取用户信息
          try {
            const userInfoRes = await getUserInfo()
            if (userInfoRes.userInfo) {
              // 使用 userStore 保存用户信息
              userStore.setUserDetailInfo(userInfoRes.userInfo)
            }
          } catch (error) {
            console.error("获取用户信息失败:", error)
          }

          // 登录成功后跳转
          if (redirectUrl) {
            // 如果有redirect参数，跳转到指定页面
            Taro.redirectTo({
              url: decodeURIComponent(redirectUrl)
            })
          } else {
            // 否则跳转到首页
            Taro.switchTab({
              url: "/pages/recommend/index/index"
            })
          }

          Taro.showToast({
            title: "登录成功",
            icon: "success"
          })
        } else if (result.needPhone) {
          // 需要手机号登录
          needPhoneLogin.value = true
          userWxId.value = result.userWxId || ""
        } else {
          // 登录失败
          Taro.showToast({
            title: result.message || "登录失败",
            icon: "none"
          })
        }
      } catch (error) {
        console.error("登录失败:", error)
        Taro.showToast({
          title: error.message || "登录失败，请重试",
          icon: "none"
        })
      } finally {
        loading.value = false
      }
    }

    // 跳转到手机号登录页面
    const goToPhoneLogin = () => {
      Taro.navigateTo({
        url: `/pages/phone-login/index?userWxId=${userWxId.value}`
      })
    }

    // 跳转到用户协议页面
    const goToAgreement = type => {
      Taro.navigateTo({
        url: `/pages/user/agreement/index?type=${type}`
      })
    }

    // 跳过登录
    const handleSkipLogin = () => {
      Taro.switchTab({
        url: "/pages/recommend/index/index"
      })
    }

    // 手机号登录相关方法
    // 清空手机号
    const clearPhone = () => {
      phone.value = ""
    }

    // 显示国家码选择器
    const showCountryCodePicker = () => {
      // TODO: 实现国家码选择器
      console.log("打开国家码选择器")
    }

    // 倒计时
    const startCountdown = () => {
      countdown.value = 60

      const timer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          clearInterval(timer)
          isGettingCode.value = false
        }
      }, 1000)
    }

    // 获取验证码
    const getSmsCode = async () => {
      if (isGettingCode.value) return

      if (!isValidPhone.value) {
        Taro.showToast({
          title: "请输入正确的手机号",
          icon: "none"
        })
        return
      }

      try {
        isGettingCode.value = true
        const response = await sendSmsCode(String(phone.value), countryCode.value, userWxId.value)
        if (response.smsCodeId) {
          smsCodeId.value = response.smsCodeId
          hasSentCode.value = true
          startCountdown()

          Taro.showToast({
            title: "验证码已发送",
            icon: "success"
          })
        } else {
          Taro.showToast({
            title: "smsCodeId为空，请重试",
            icon: "none"
          })
        }
      } catch (error) {
        console.error("获取验证码失败", error)
        Taro.showToast({
          title: error.message,
          icon: "none"
        })
      }
    }

    // 手机号登录
    const handlePhoneLogin = async () => {
      if (!canPhoneLogin.value) {
        if (!isValidPhone.value) {
          Taro.showToast({
            title: "请输入正确的手机号",
            icon: "none"
          })
        } else if (!String(smsCode.value).length) {
          Taro.showToast({
            title: "请输入验证码",
            icon: "none"
          })
        } else if (!privacyChecked.value) {
          Taro.showToast({
            title: "请阅读并同意用户协议",
            icon: "none"
          })
        } else if (!hasSentCode.value) {
          Taro.showToast({
            title: "请先获取验证码",
            icon: "none"
          })
        } else if (String(smsCode.value).length !== 4) {
          Taro.showToast({
            title: "验证码长度不正确，请重新输入",
            icon: "none"
          })
        }
        return
      }

      phoneLogging.value = true

      try {
        const response = await phoneLogin(smsCodeId.value, String(smsCode.value))
        if (response.token.token) {
          // 使用 userStore 保存token信息
          userStore.setToken(response.token.token)
          if (response.token.expiredAt) {
            userStore.setTokenExpiredAt(new Date(response.token.expiredAt).getTime())
          }
          if (response.token.refreshAt) {
            userStore.setTokenRefreshAt(new Date(response.token.refreshAt).getTime())
          }

          // 获取用户详细信息
          try {
            const userInfoResponse = await getUserInfo()
            if (userInfoResponse.userInfo) {
              userStore.setUserDetailInfo(userInfoResponse.userInfo)
            }
          } catch (error) {
            console.error("获取用户信息失败", error)
          }

          Taro.showToast({
            title: "登录成功",
            icon: "success"
          })

          // 登录成功后跳转
          setTimeout(() => {
            if (redirectUrl) {
              // 如果有redirect参数，跳转到指定页面
              Taro.redirectTo({
                url: decodeURIComponent(redirectUrl)
              })
            } else {
              // 否则跳转到首页
              Taro.switchTab({
                url: "/pages/recommend/index/index"
              })
            }
          }, 500)
        } else {
          Taro.showToast({
            title: "登录失败，请稍后重试",
            icon: "none"
          })
        }
      } catch (error) {
        console.error("手机号登录失败", error)
        Taro.showToast({
          title: error.message || "登录失败，请稍后重试",
          icon: "none"
        })
      } finally {
        phoneLogging.value = false
      }
    }

    return {
      loading,
      privacyChecked,
      needPhoneLogin,
      phoneLogging,
      countryCode,
      phone,
      smsCode,
      isGettingCode,
      isValidPhone,
      canPhoneLogin,
      codeButtonText,
      togglePrivacyCheck,
      showPrivacyTip,
      handleWxLogin,
      goToPhoneLogin,
      goToAgreement,
      handleSkipLogin,
      clearPhone,
      showCountryCodePicker,
      getSmsCode,
      handlePhoneLogin
    }
  }
}
</script>

<style lang="less">
:root {
  --status-bar-height: 20px;
}

.login-container {
  min-height: 100vh;
  background: url("https://fp.yangcong345.com/middle/1.0.1/loginBg__w.png") no-repeat center;
  background-size: 100% auto; // 宽度100%，高度自适应
  display: flex;
  flex-direction: column;
  align-items: center;

  .header {
    margin-top: 129px;
    margin-bottom: 60px;

    .logo {
      width: 197px;
      height: 181px;
    }
  }

  .login-card {
    width: 686px;
    border-radius: 32px;
    background: #ffffff;
    padding: 40px;

    .login-tip {
      font-family: PingFang SC;
      font-size: 32px;
      font-weight: 600;
      line-height: 32px;
      color: #393548;
      margin-bottom: 48px;
    }

    .quick-login-btn {
      width: 100%;
      margin-bottom: 20px;
      font-family: Alibaba PuHuiTi 2;
      font-size: 38px;
      font-weight: 1000;
      line-height: normal;
      text-align: center;

      .login-button {
        color: #ffffff;
        width: 100%;
        height: 104px;
        border-radius: 318px;
        background: linear-gradient(100deg, #ffb521 0%, #ff9c36 99%);
        border: 6px solid #ffffff;
        box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: center;
        align-items: center;
      }
    }

    // 手机号登录表单样式
    .phone-login-form {
      width: 100%;

      .form-item {
        margin-bottom: 20px;
        border-radius: 4px;
        background: #f2f2f2;
      }

      .phone-input {
        position: relative;
        display: flex;
        align-items: center;
        height: 96px;
        padding-left: 20px;
        justify-content: flex-start;

        .country-code {
          display: flex;
          align-items: center;
          margin-right: 38px;
          font-family: PingFang SC;
          font-size: 32px;
          font-weight: 600;
          line-height: 32px;
          letter-spacing: normal;
          color: #504b64;

          .arrow {
            width: 18px;
            height: 18px;
            margin-left: 16px;
          }
        }

        .phone-input-item {
          width: 350rpx;
          border: none;
          background: transparent;
          padding: 16px 0;
          outline: none;
          font-family: PingFang SC;
          font-size: 32px;
          line-height: 32px;
          letter-spacing: normal;
          color: #504b64;
          font-weight: 600;
        }

        .clear-btn {
          z-index: 2;
          position: absolute;
          right: 16px;
          width: 36px;
          height: 36px;
        }
      }

      .code-input {
        position: relative;
        display: flex;
        align-items: center;
        height: 96px;
        padding: 32px 16px 32px 32px;
        justify-content: flex-start;

        .code-input-item {
          width: 350rpx;
          border: none;
          background: transparent;
          padding: 16px 0;
          outline: none;
          font-family: PingFang SC;
          font-size: 32px;
          line-height: 32px;
          letter-spacing: normal;
          color: #504b64;
          font-weight: 600;
        }

        .get-code-btn {
          position: absolute;
          z-index: 2;
          right: 16px;
          white-space: nowrap;
          border: none;
          background: transparent;
          font-family: PingFang SC;
          font-size: 32px;
          font-weight: normal;
          line-height: 32px;
          letter-spacing: normal;
          color: #518aff;
          cursor: pointer;

          &.disabled {
            color: #999;
            cursor: not-allowed;
          }

          &::after {
            border: none;
          }
        }
      }

      .login-btn-container {
        margin: 32px 0;
      }

      .phone-login-button {
        width: 100%;
        height: 104px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(100deg, #ffb521 0%, #ff9c36 99%);
        border-radius: 318px;
        border: 6px solid #ffffff;
        box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.1);
        font-family: Alibaba PuHuiTi 2;
        font-size: 38px;
        font-weight: 1000;
        line-height: normal;
        text-align: center;
        letter-spacing: normal;
        color: #fff;

        &.disabled {
          background: #cccccc;
          color: #999999;
        }
      }
    }

    .skip-login {
      font-family: PingFang SC;
      font-size: 32px;
      font-weight: normal;
      line-height: 32px;
      text-align: center;
      letter-spacing: normal;
      text-decoration: underline;
      color: #848096;
      margin: 0 auto 30px auto;
    }

    .privacy-agreement {
      display: flex;
      align-items: center;
      height: 36px;

      .check-box {
        margin-right: 8px;

        image {
          width: 24px;
          height: 24px;
        }
      }

      .privacy-text {
        font-family: PingFang SC;
        font-size: 24px;
        font-weight: normal;
        letter-spacing: normal;
        color: #b8b4c7;

        .privacy-text-link {
          text-decoration: underline;
        }
      }
    }
  }
}
</style>
