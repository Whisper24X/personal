<template>
  <view class="vertical-list">
    <view v-for="item in items" :key="item.id" class="list-item" @tap="handleItemClick(item)">
      <text class="item-title">{{ item.title }}</text>
      <view class="item-content">
        <image class="item-thumbnail" :src="item.thumbnail" mode="aspectFill" />
        <text class="item-desc">{{ item.description }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface ListItem {
  id: string
  title: string
  description: string
  thumbnail: string
}

interface Props {
  items: ListItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  itemClick: [item: ListItem]
}>()

const handleItemClick = (item: ListItem) => {
  emit("itemClick", item)
}
</script>

<style lang="less">
.vertical-list {
  .list-item {
    margin-bottom: 24rpx;
    padding: 32rpx;
    background: #fff;
    border-radius: 24rpx;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    .item-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #393548;
      line-height: 1.4;
      margin-bottom: 24rpx;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .item-content {
      display: flex;
      gap: 24rpx;

      .item-thumbnail {
        width: 126rpx;
        height: 126rpx;
        border-radius: 15rpx;
        background: #f0f0f0;
        flex-shrink: 0;
      }

      .item-desc {
        flex: 1;
        font-size: 28rpx;
        color: #504b64;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
  }
}
</style>
