<template>
  <view class="rating-selector">
    <view class="left">
      <view class="title" :style="titleStyle">{{ title }}</view>
      <view
        class="icon-container"
        :class="{
          star: iconType === 'star'
        }"
      >
        <view v-for="index in 5" :key="index" class="icon" @tap="selectRating(index)">
          <image
            :src="index <= modelValue ? getIcon(modelValue).active : getIcon(index).inactive"
            alt="icon"
          />
        </view>
      </view>
    </view>
    <view class="rating-text" :style="titleStyle">{{ getRatingText() }}</view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps({
  title: {
    type: String,
    default: "总体评价"
  },
  modelValue: {
    type: Number,
    default: 0
  },
  iconType: {
    type: String,
    default: "star"
  },
  titleStyle: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(["update:modelValue"])
// 星星图片资源
const iconMap: Record<string, Record<string, Record<string, string>>> = {
  smile: {
    stage1: {
      active: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage1-active__w.png",
      inactive: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage1__w.png"
    },
    stage2: {
      active: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage2-active__w.png",
      inactive: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage2__w.png"
    },
    stage3: {
      active: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage3-active__w.png",
      inactive: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage3__w.png"
    },
    stage4: {
      active: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage4-active__w.png",
      inactive: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage4__w.png"
    },
    stage5: {
      active: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage5-active__w.png",
      inactive: "https://fp.yangcong345.com/middle/1.0.0/smile/smile-stage5__w.png"
    }
  },
  star: {
    stage: {
      active: "https://fp.yangcong345.com/middle/1.0.0/star/star-active__w.png",
      inactive: "https://fp.yangcong345.com/middle/1.0.0/star/star__w.png"
    }
  }
}
const getIcon = (index: number) => {
  if (props.iconType === "star") {
    return iconMap[props.iconType][`stage`]
  } else {
    return iconMap[props.iconType][`stage${index}`]
  }
}

// 选择评分
const selectRating = (rating: number) => {
  emit("update:modelValue", rating)
}

// 获取评分文本
const getRatingText = () => {
  const ratingMap: Record<number, string> = {
    0: "",
    1: "很糟糕",
    2: "很差",
    3: "一般",
    4: "还不错",
    5: "超预期"
  }

  return ratingMap[props.modelValue] || ""
}
</script>

<style lang="less">
.rating-selector {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .left {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 28px;

    .title {
      font-family: "PingFang SC", sans-serif;
      font-size: 28px;
      font-weight: normal;
      color: #393548;
    }

    .icon-container {
      display: flex;
      justify-content: center;
      gap: 32px;

      .icon {
        width: 48px;
        height: 48px;

        image {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
      }

      &.star {
        gap: 42px;

        .icon {
          width: 48px;
          height: 48px;

          image {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }
      }
    }
  }

  .rating-text {
    width: 84px;
    font-family: "PingFang SC", sans-serif;
    font-size: 28px;
    font-weight: normal;
    color: #393548;
  }
}
</style>
