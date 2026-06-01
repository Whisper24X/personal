# ainative-app 单文件原型示例

完整的移动端风格单文件 HTML 原型示例。

---

## 示例 1: 商品列表（完整功能）

**文件位置**: `docs/prototype/product-list/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>原型 - 商品列表</title>

    <style>
      :root {
        --primary-color: #1890ff;
        --success-color: #52c41a;
        --warning-color: #faad14;
        --error-color: #ff4d4f;
        --text-color: #333333;
        --text-secondary: #666666;
        --text-tertiary: #999999;
        --bg-color: #f5f5f5;
        --border-color: #eeeeee;
        --spacing-xs: 4px;
        --spacing-sm: 8px;
        --spacing-md: 12px;
        --spacing-lg: 16px;
        --spacing-xl: 24px;
        --border-radius: 8px;
        --box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg-color);
        color: var(--text-color);
        font-size: 14px;
        line-height: 1.5;
        max-width: 750px;
        margin: 0 auto;
      }

      #app {
        min-height: 100vh;
      }

      .prototype-badge {
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: var(--warning-color);
        color: white;
        padding: 6px 12px;
        border-radius: var(--border-radius);
        font-size: 12px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: var(--box-shadow);
      }

      /* 导航栏 */
      .navbar {
        position: sticky;
        top: 0;
        background: white;
        padding: var(--spacing-md);
        display: flex;
        align-items: center;
        box-shadow: var(--box-shadow);
        z-index: 100;
      }

      .navbar-back {
        font-size: 20px;
        cursor: pointer;
        margin-right: var(--spacing-md);
      }

      .navbar-title {
        flex: 1;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
      }

      /* 搜索栏 */
      .search-bar {
        background: white;
        padding: var(--spacing-md);
        display: flex;
        gap: var(--spacing-sm);
      }

      .search-input {
        flex: 1;
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--bg-color);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        font-size: 14px;
      }

      .search-btn {
        padding: var(--spacing-sm) var(--spacing-lg);
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        font-size: 14px;
        cursor: pointer;
      }

      /* 筛选标签 */
      .filter-tabs {
        display: flex;
        background: white;
        padding: var(--spacing-sm) var(--spacing-md);
        border-bottom: 1px solid var(--border-color);
      }

      .filter-tab {
        flex: 1;
        text-align: center;
        padding: var(--spacing-xs) 0;
        font-size: 14px;
        color: var(--text-secondary);
        cursor: pointer;
        position: relative;
      }

      .filter-tab.active {
        color: var(--primary-color);
        font-weight: 600;
      }

      .filter-tab.active::after {
        content: '';
        position: absolute;
        bottom: -var(--spacing-sm);
        left: 50%;
        transform: translateX(-50%);
        width: 20px;
        height: 3px;
        background: var(--primary-color);
        border-radius: 2px;
      }

      /* 商品列表 */
      .product-list {
        padding: var(--spacing-md);
      }

      .product-item {
        display: flex;
        background: white;
        border-radius: var(--border-radius);
        margin-bottom: var(--spacing-md);
        padding: var(--spacing-md);
        box-shadow: var(--box-shadow);
        cursor: pointer;
      }

      .product-image {
        width: 90px;
        height: 90px;
        border-radius: var(--border-radius);
        object-fit: cover;
        flex-shrink: 0;
        margin-right: var(--spacing-md);
      }

      .product-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .product-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .product-desc {
        font-size: 13px;
        color: var(--text-secondary);
        margin-top: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .product-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--spacing-sm);
      }

      .product-price {
        font-size: 18px;
        font-weight: 600;
        color: var(--error-color);
      }

      .product-sales {
        font-size: 12px;
        color: var(--text-secondary);
      }

      /* 加载/空状态 */
      .loading,
      .empty {
        text-align: center;
        padding: var(--spacing-xl) 0;
        color: var(--text-secondary);
      }

      .load-more {
        text-align: center;
        padding: var(--spacing-lg) 0;
        font-size: 13px;
        color: var(--text-secondary);
      }
    </style>
  </head>
  <body>
    <!--
    原型名称: 商品列表
    创建时间: 2026-02-03
    
    功能说明:
    - 商品列表展示
    - 搜索功能
    - 分类筛选（全部、热销、新品、特惠）
    - 下拉刷新（简化实现）
    - 上拉加载更多
    
    如何使用:
    1. 双击打开或使用本地服务器
    2. 在手机浏览器或浏览器开发者工具的移动设备模式下查看
    3. 测试搜索、筛选、滚动加载功能
    
    原型限制:
    - 使用模拟数据（45条）
    - 简化的下拉刷新（仅重新加载）
    - 未实现图片懒加载
    
    下一步:
    如果验证通过，需要:
    1. 在 ainative-app 中创建正式页面（src/pages/product/list/）
    2. 实现真实 API 调用（src/api/product.ts）
    3. 使用 Taro 的下拉刷新组件
    4. 添加图片懒加载
    5. 集成埋点
  -->

    <div id="app">
      <div class="prototype-badge">🚧 原型</div>

      <!-- 导航栏 -->
      <div class="navbar">
        <span class="navbar-back" @click="handleBack">←</span>
        <div class="navbar-title">商品列表</div>
        <div style="width: 20px;"></div>
      </div>

      <!-- 搜索栏 -->
      <div class="search-bar">
        <input v-model="keyword" placeholder="搜索商品" class="search-input" @keyup.enter="handleSearch" />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </div>

      <!-- 筛选标签 -->
      <div class="filter-tabs">
        <div
          v-for="tab in filterTabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeFilter === tab.value }"
          @click="handleFilterChange(tab.value)"
        >
          {{ tab.label }}
        </div>
      </div>

      <!-- 商品列表 -->
      <div v-if="loading && list.length === 0" class="loading">加载中...</div>

      <div v-else-if="list.length === 0" class="empty">暂无商品</div>

      <div v-else class="product-list">
        <div v-for="product in list" :key="product.id" class="product-item" @click="handleProductClick(product.id)">
          <img :src="product.image" class="product-image" />
          <div class="product-info">
            <div class="product-name">{{ product.name }}</div>
            <div class="product-desc">{{ product.description }}</div>
            <div class="product-footer">
              <div class="product-price">¥{{ product.price }}</div>
              <div class="product-sales">已售 {{ product.sales }}</div>
            </div>
          </div>
        </div>

        <!-- 加载更多提示 -->
        <div v-if="!finished" class="load-more" @click="loadMore">{{ loadingMore ? '加载中...' : '点击加载更多' }}</div>
        <div v-else class="load-more">没有更多了</div>
      </div>
    </div>

    <script src="https://fp.yangcong345.com/middle/base/vue.global.prod.min-0b54d44c0a1191e01683f5d626686f5e.js"></script>

    <script>
      const { createApp, ref, onMounted } = Vue;

      // 模拟数据生成
      const generateMockProducts = (count = 45) => {
        return Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          name: `商品名称 ${i + 1}`,
          description: `这是商品 ${i + 1} 的描述信息，支持多行显示`,
          price: Math.floor(Math.random() * 500) + 50,
          image: `https://via.placeholder.com/180/409EFF/FFFFFF?text=P${i + 1}`,
          sales: Math.floor(Math.random() * 1000),
          isHot: Math.random() > 0.7,
          isNew: i < 10,
          onSale: Math.random() > 0.6,
        }));
      };

      createApp({
        setup() {
          const keyword = ref('');
          const activeFilter = ref('all');
          const loading = ref(false);
          const loadingMore = ref(false);
          const finished = ref(false);
          const page = ref(1);
          const pageSize = 10;

          const filterTabs = [
            { label: '全部', value: 'all' },
            { label: '热销', value: 'hot' },
            { label: '新品', value: 'new' },
            { label: '特惠', value: 'sale' },
          ];

          const allProducts = generateMockProducts();
          const list = ref([]);

          // 延迟函数
          const delay = (ms = 800) => new Promise((resolve) => setTimeout(resolve, ms));

          // 获取筛选后的数据
          const getFilteredData = () => {
            let filtered = [...allProducts];

            // 搜索
            if (keyword.value) {
              filtered = filtered.filter((p) => p.name.includes(keyword.value));
            }

            // 分类筛选
            if (activeFilter.value === 'hot') {
              filtered = filtered.filter((p) => p.isHot);
            } else if (activeFilter.value === 'new') {
              filtered = filtered.filter((p) => p.isNew);
            } else if (activeFilter.value === 'sale') {
              filtered = filtered.filter((p) => p.onSale);
            }

            return filtered;
          };

          // 加载数据
          const loadData = async (isRefresh = false) => {
            if (isRefresh) {
              page.value = 1;
              finished.value = false;
              loading.value = true;
            } else {
              loadingMore.value = true;
            }

            await delay();

            const filtered = getFilteredData();
            const start = (page.value - 1) * pageSize;
            const end = start + pageSize;
            const pageData = filtered.slice(start, end);

            if (isRefresh || page.value === 1) {
              list.value = pageData;
            } else {
              list.value = [...list.value, ...pageData];
            }

            if (pageData.length < pageSize || end >= filtered.length) {
              finished.value = true;
            }

            loading.value = false;
            loadingMore.value = false;
          };

          // 搜索
          const handleSearch = () => {
            loadData(true);
          };

          // 切换筛选
          const handleFilterChange = (value) => {
            if (activeFilter.value === value) return;
            activeFilter.value = value;
            loadData(true);
          };

          // 加载更多
          const loadMore = () => {
            if (loading.value || loadingMore.value || finished.value) return;
            page.value += 1;
            loadData();
          };

          // 点击商品
          const handleProductClick = (id) => {
            alert(`跳转到商品详情页: ${id}`);
          };

          // 返回
          const handleBack = () => {
            alert('返回上一页');
          };

          // 初始化
          onMounted(() => {
            loadData(true);
          });

          return {
            keyword,
            activeFilter,
            loading,
            loadingMore,
            finished,
            filterTabs,
            list,
            handleSearch,
            handleFilterChange,
            loadMore,
            handleProductClick,
            handleBack,
          };
        },
      }).mount('#app');
    </script>
  </body>
</html>
```

---

## 示例 2: 表单提交

**文件位置**: `docs/prototype/profile-edit/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>原型 - 编辑资料</title>

    <style>
      :root {
        --primary-color: #1890ff;
        --text-color: #333333;
        --text-secondary: #666666;
        --bg-color: #f5f5f5;
        --border-color: #eeeeee;
        --spacing-sm: 8px;
        --spacing-md: 12px;
        --spacing-lg: 16px;
        --border-radius: 8px;
        --box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg-color);
        color: var(--text-color);
        font-size: 14px;
        max-width: 750px;
        margin: 0 auto;
      }

      #app {
        min-height: 100vh;
        padding-bottom: 80px;
      }

      .prototype-badge {
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: #faad14;
        color: white;
        padding: 6px 12px;
        border-radius: var(--border-radius);
        font-size: 12px;
        font-weight: 600;
        z-index: 9999;
      }

      /* 导航栏 */
      .navbar {
        position: sticky;
        top: 0;
        background: white;
        padding: var(--spacing-md);
        display: flex;
        align-items: center;
        box-shadow: var(--box-shadow);
        z-index: 100;
      }

      .navbar-back {
        font-size: 20px;
        cursor: pointer;
        margin-right: var(--spacing-md);
      }
      .navbar-title {
        flex: 1;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
      }

      /* 表单容器 */
      .form-container {
        background: white;
        margin: var(--spacing-lg);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .form-item {
        display: flex;
        align-items: center;
        padding: var(--spacing-md) var(--spacing-lg);
        border-bottom: 1px solid var(--border-color);
      }

      .form-item:last-child {
        border-bottom: none;
      }

      .form-label {
        width: 80px;
        font-size: 14px;
        color: var(--text-color);
        flex-shrink: 0;
      }

      .form-label.required::before {
        content: '*';
        color: #ff4d4f;
        margin-right: 4px;
      }

      .form-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 14px;
        padding: var(--spacing-sm) 0;
      }

      .form-input::placeholder {
        color: #cccccc;
      }

      /* 头像上传 */
      .avatar-uploader {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        overflow: hidden;
        cursor: pointer;
        background: var(--bg-color);
        border: 2px dashed var(--border-color);
      }

      .avatar-uploader img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-placeholder {
        font-size: 12px;
        color: var(--text-secondary);
        text-align: center;
      }

      /* 单选按钮 */
      .radio-group {
        display: flex;
        gap: var(--spacing-lg);
      }

      .radio-item {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }

      .radio {
        width: 18px;
        height: 18px;
        border: 2px solid var(--border-color);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .radio.checked {
        border-color: var(--primary-color);
      }

      .radio-dot {
        width: 10px;
        height: 10px;
        background: var(--primary-color);
        border-radius: 50%;
      }

      /* Textarea */
      .textarea {
        width: 100%;
        min-height: 80px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: var(--spacing-md);
        font-size: 14px;
        resize: vertical;
        font-family: inherit;
      }

      .char-count {
        text-align: right;
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 4px;
      }

      /* 底部按钮 */
      .footer-actions {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        max-width: 750px;
        margin: 0 auto;
        background: white;
        padding: var(--spacing-lg);
        box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
      }

      .submit-btn {
        width: 100%;
        padding: 12px 0;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
      }

      .submit-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="prototype-badge">🚧 原型</div>

      <!-- 导航栏 -->
      <div class="navbar">
        <span class="navbar-back">←</span>
        <div class="navbar-title">编辑资料</div>
        <div style="width: 20px;"></div>
      </div>

      <!-- 表单 -->
      <div class="form-container">
        <!-- 头像 -->
        <div class="form-item">
          <div class="form-label">头像</div>
          <div class="avatar-uploader" @click="handleChooseAvatar">
            <img v-if="formData.avatar" :src="formData.avatar" />
            <div v-else class="avatar-placeholder">点击上传</div>
          </div>
        </div>

        <!-- 昵称 -->
        <div class="form-item">
          <div class="form-label required">昵称</div>
          <input v-model="formData.nickname" placeholder="请输入昵称" class="form-input" />
        </div>

        <!-- 性别 -->
        <div class="form-item">
          <div class="form-label">性别</div>
          <div class="radio-group">
            <div v-for="option in genderOptions" :key="option.value" class="radio-item" @click="formData.gender = option.value">
              <div class="radio" :class="{ checked: formData.gender === option.value }">
                <div v-if="formData.gender === option.value" class="radio-dot"></div>
              </div>
              <span>{{ option.label }}</span>
            </div>
          </div>
        </div>

        <!-- 手机号 -->
        <div class="form-item">
          <div class="form-label">手机号</div>
          <input v-model="formData.phone" type="tel" placeholder="请输入手机号" class="form-input" />
        </div>

        <!-- 邮箱 -->
        <div class="form-item">
          <div class="form-label">邮箱</div>
          <input v-model="formData.email" type="email" placeholder="请输入邮箱" class="form-input" />
        </div>
      </div>

      <!-- 个人简介 -->
      <div class="form-container" style="margin-top: 0;">
        <div class="form-item" style="display: block; border-bottom: none;">
          <div class="form-label" style="margin-bottom: var(--spacing-sm);">个人简介</div>
          <textarea v-model="formData.bio" placeholder="请输入个人简介" class="textarea" maxlength="200"></textarea>
          <div class="char-count">{{ formData.bio.length }}/200</div>
        </div>
      </div>

      <!-- 提交按钮 -->
      <div class="footer-actions">
        <button class="submit-btn" @click="handleSubmit" :disabled="submitting">{{ submitting ? '保存中...' : '保存' }}</button>
      </div>
    </div>

    <script src="https://fp.yangcong345.com/middle/base/vue.global.prod.min-0b54d44c0a1191e01683f5d626686f5e.js"></script>

    <script>
      const { createApp, ref, reactive } = Vue;

      createApp({
        setup() {
          const submitting = ref(false);

          const formData = reactive({
            avatar: '',
            nickname: '张三',
            gender: 'male',
            phone: '13800138000',
            email: 'zhangsan@example.com',
            bio: '',
          });

          const genderOptions = [
            { label: '男', value: 'male' },
            { label: '女', value: 'female' },
            { label: '保密', value: 'unknown' },
          ];

          // 选择头像
          const handleChooseAvatar = () => {
            // 原型：使用占位图
            const confirmed = confirm('选择头像功能（原型演示）\n实际应用中会调用文件选择器');
            if (confirmed) {
              formData.avatar = `https://via.placeholder.com/150/409EFF/FFFFFF?text=Avatar`;
            }
          };

          // 提交表单
          const handleSubmit = async () => {
            // 简单验证
            if (!formData.nickname.trim()) {
              alert('请输入昵称');
              return;
            }

            if (formData.phone && !/^1\d{10}$/.test(formData.phone)) {
              alert('请输入正确的手机号');
              return;
            }

            submitting.value = true;

            // 模拟提交延迟
            await new Promise((resolve) => setTimeout(resolve, 1500));

            submitting.value = false;

            alert('保存成功！');
            console.log('表单数据:', formData);
          };

          return {
            formData,
            genderOptions,
            submitting,
            handleChooseAvatar,
            handleSubmit,
          };
        },
      }).mount('#app');
    </script>
  </body>
</html>
```

---

## 示例 3: 商品详情

**文件位置**: `docs/prototype/product-detail/index.html`

[此处省略完整代码，包含轮播图、规格选择、底部操作栏等]

---

## 移动端设计要点

### 1. 响应式单位

使用固定 px 值，避免复杂计算：

```css
font-size: 14px; /* 而非 rem 或 vw */
padding: 12px;
```

### 2. 触摸优化

```css
* {
  -webkit-tap-highlight-color: transparent; /* 移除点击高亮 */
}

.button {
  padding: 12px 24px; /* 至少 44x44px 点击区域 */
}
```

### 3. 安全区域

```css
.footer {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
```

### 4. 滚动优化

```css
.scroll-container {
  -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
  overflow-y: auto;
}
```

### 5. 最大宽度

```css
body {
  max-width: 750px; /* 限制最大宽度 */
  margin: 0 auto; /* 居中显示 */
}
```

---

## 快速生成技巧

### 1. 使用占位图

```javascript
const placeholder = (size, text) => `https://via.placeholder.com/${size}/409EFF/FFFFFF?text=${text}`;

// 使用
image: placeholder('180', 'Product');
```

### 2. 模拟文件选择

```javascript
const handleChooseImage = () => {
  const confirmed = confirm('原型演示：选择图片');
  if (confirmed) {
    formData.image = placeholder('300', 'Selected');
  }
};
```

### 3. 简化的交互反馈

```javascript
// 使用原生 alert/confirm
alert('操作成功！');
const confirmed = confirm('确定删除吗？');
```

### 4. 模拟页面跳转

```javascript
const handleDetail = (id) => {
  alert(`跳转到详情页: ${id}\n（原型演示）`);
};
```

---

## 测试建议

### 在移动设备上测试

1. **浏览器开发者工具**
   - Chrome DevTools 移动设备模式
   - 选择常见设备（iPhone、Android）

2. **真机测试**
   - 使用本地服务器
   - 扫码或直接访问 IP
   - 测试触摸交互

### 测试检查清单

- [ ] 字体大小适中（14-16px）
- [ ] 点击区域足够大（44x44px）
- [ ] 滚动流畅
- [ ] 输入框正常工作
- [ ] 底部按钮不被遮挡
- [ ] 横屏显示正常（可选）
