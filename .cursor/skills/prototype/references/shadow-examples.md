# ainative-shadow 单文件原型示例

完整的管理后台风格单文件 HTML 原型示例。

---

## 示例 1: 用户列表（完整功能）

**文件位置**: `docs/prototype/user-list/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>原型 - 用户列表管理</title>
  
  <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">
  
  <style>
    :root {
      --primary-color: #1890ff;
      --success-color: #52c41a;
      --warning-color: #faad14;
      --error-color: #ff4d4f;
      --text-color: #333333;
      --text-secondary: #666666;
      --bg-color: #f5f5f5;
      --border-color: #eeeeee;
      --spacing-md: 16px;
      --spacing-lg: 24px;
      --border-radius: 8px;
      --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
    }

    #app {
      padding: var(--spacing-lg);
      max-width: 1400px;
      margin: 0 auto;
    }

    .prototype-badge {
      position: fixed;
      top: 10px;
      right: 10px;
      background: var(--warning-color);
      color: white;
      padding: 8px 16px;
      border-radius: var(--border-radius);
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: var(--box-shadow);
    }

    .toolbar {
      margin-bottom: var(--spacing-md);
    }

    .el-pagination {
      margin-top: var(--spacing-md);
      justify-content: flex-end;
    }
  </style>
</head>
<body>
  <!--
    原型名称: 用户列表管理
    创建时间: 2026-02-03
    
    功能说明:
    - 用户列表展示
    - 搜索筛选（用户名、状态）
    - 分页功能
    - 新增/编辑/删除操作
    
    如何使用:
    1. 双击打开或使用本地服务器（python -m http.server 8000）
    2. 测试搜索、筛选、分页功能
    3. 点击新增/编辑按钮查看对话框
    
    原型限制:
    - 使用 LocalStorage 模拟数据持久化
    - 未实现表单验证
    - 简化的错误处理
    
    下一步:
    如果验证通过，需要:
    1. 在 ainative-shadow 中创建正式页面组件
    2. 定义 API 类型（src/types/api/api.d.ts）
    3. 实现真实 API 调用（src/api/user.ts）
    4. 完善表单验证和错误处理
    5. 添加权限控制
  -->

  <div id="app">
    <div class="prototype-badge">🚧 原型演示</div>

    <el-card>
      <template #header>
        <span style="font-size: 18px; font-weight: 600;">用户列表管理</span>
      </template>

      <!-- 搜索表单 -->
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="用户名">
          <el-input 
            v-model="searchForm.username" 
            placeholder="请输入用户名"
            clearable
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="选择状态" clearable>
            <el-option label="全部" value="" />
            <el-option label="正常" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">
            搜索
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 操作栏 -->
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">新增用户</el-button>
        <el-button type="danger" :disabled="selectedIds.length === 0">
          批量删除 ({{ selectedIds.length }})
        </el-button>
      </div>

      <!-- 数据表格 -->
      <el-table 
        :data="tableData" 
        v-loading="loading"
        @selection-change="handleSelectionChange"
        border
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'info'">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
              {{ row.status === 'active' ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="fetchData"
        @current-change="fetchData"
      />
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="dialogTitle"
      width="600px"
    >
      <el-form :model="formData" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="formData.username" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="formData.email" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="formData.role" style="width: 100%;">
            <el-option label="管理员" value="admin" />
            <el-option label="普通用户" value="user" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch 
            v-model="formData.status" 
            active-value="active"
            inactive-value="inactive"
            active-text="正常"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>

  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/element-plus"></script>
  
  <script>
    const { createApp, ref, reactive, onMounted } = Vue;
    const { ElMessage, ElMessageBox } = ElementPlus;

    createApp({
      setup() {
        // 搜索表单
        const searchForm = reactive({
          username: '',
          status: ''
        });

        // 分页
        const pagination = reactive({
          page: 1,
          pageSize: 10,
          total: 0
        });

        // 表格数据
        const loading = ref(false);
        const tableData = ref([]);
        const selectedIds = ref([]);

        // 对话框
        const dialogVisible = ref(false);
        const dialogTitle = ref('新增用户');
        const submitting = ref(false);
        const formData = reactive({
          id: null,
          username: '',
          email: '',
          role: 'user',
          status: 'active'
        });

        // 模拟数据生成
        const generateMockData = (count = 45) => {
          return Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            username: `user${i + 1}`,
            email: `user${i + 1}@example.com`,
            role: i % 5 === 0 ? 'admin' : 'user',
            status: i % 7 === 0 ? 'inactive' : 'active',
            createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString().slice(0, 19).replace('T', ' ')
          }));
        };

        // 初始化数据
        const initData = () => {
          const saved = localStorage.getItem('prototype-user-data');
          if (saved) {
            return JSON.parse(saved);
          }
          const data = generateMockData();
          localStorage.setItem('prototype-user-data', JSON.stringify(data));
          return data;
        };

        let allData = initData();

        // 保存数据
        const saveData = () => {
          localStorage.setItem('prototype-user-data', JSON.stringify(allData));
        };

        // 延迟函数
        const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

        // 加载数据
        const fetchData = async () => {
          loading.value = true;
          await delay();

          // 筛选
          let filtered = [...allData];
          if (searchForm.username) {
            filtered = filtered.filter(u => u.username.includes(searchForm.username));
          }
          if (searchForm.status) {
            filtered = filtered.filter(u => u.status === searchForm.status);
          }

          // 分页
          pagination.total = filtered.length;
          const start = (pagination.page - 1) * pagination.pageSize;
          const end = start + pagination.pageSize;
          tableData.value = filtered.slice(start, end);

          loading.value = false;
        };

        // 搜索
        const handleSearch = () => {
          pagination.page = 1;
          fetchData();
        };

        // 重置
        const handleReset = () => {
          searchForm.username = '';
          searchForm.status = '';
          pagination.page = 1;
          fetchData();
        };

        // 新增
        const handleAdd = () => {
          dialogTitle.value = '新增用户';
          Object.assign(formData, {
            id: null,
            username: '',
            email: '',
            role: 'user',
            status: 'active'
          });
          dialogVisible.value = true;
        };

        // 编辑
        const handleEdit = (row) => {
          dialogTitle.value = '编辑用户';
          Object.assign(formData, { ...row });
          dialogVisible.value = true;
        };

        // 删除
        const handleDelete = async (row) => {
          try {
            await ElMessageBox.confirm(`确定删除用户 ${row.username} 吗？`, '提示', {
              type: 'warning'
            });

            await delay(300);
            allData = allData.filter(u => u.id !== row.id);
            saveData();
            ElMessage.success('删除成功');
            fetchData();
          } catch (error) {
            if (error !== 'cancel') {
              ElMessage.error('删除失败');
            }
          }
        };

        // 提交表单
        const handleSubmit = async () => {
          if (!formData.username || !formData.email) {
            ElMessage.warning('请填写完整信息');
            return;
          }

          submitting.value = true;
          await delay(800);

          if (formData.id) {
            // 更新
            const index = allData.findIndex(u => u.id === formData.id);
            if (index !== -1) {
              allData[index] = { ...formData };
            }
            ElMessage.success('更新成功');
          } else {
            // 新增
            const newUser = {
              ...formData,
              id: Math.max(...allData.map(u => u.id)) + 1,
              createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
            };
            allData.unshift(newUser);
            ElMessage.success('创建成功');
          }

          saveData();
          dialogVisible.value = false;
          submitting.value = false;
          fetchData();
        };

        // 选择变化
        const handleSelectionChange = (selection) => {
          selectedIds.value = selection.map(item => item.id);
        };

        // 初始化
        onMounted(() => {
          fetchData();
        });

        return {
          searchForm,
          pagination,
          loading,
          tableData,
          selectedIds,
          dialogVisible,
          dialogTitle,
          submitting,
          formData,
          handleSearch,
          handleReset,
          handleAdd,
          handleEdit,
          handleDelete,
          handleSubmit,
          handleSelectionChange,
          fetchData
        };
      }
    }).use(ElementPlus).mount('#app');
  </script>
</body>
</html>
```

---

## 示例 2: 数据仪表盘

**文件位置**: `docs/prototype/dashboard/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>原型 - 数据仪表盘</title>
  
  <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">
  
  <style>
    :root {
      --primary-color: #1890ff;
      --success-color: #52c41a;
      --warning-color: #faad14;
      --error-color: #ff4d4f;
      --bg-color: #f5f5f5;
      --spacing-md: 16px;
      --spacing-lg: 24px;
      --border-radius: 8px;
      --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      line-height: 1.6;
    }

    #app {
      padding: var(--spacing-lg);
      max-width: 1400px;
      margin: 0 auto;
    }

    .prototype-badge {
      position: fixed;
      top: 10px;
      right: 10px;
      background: var(--warning-color);
      color: white;
      padding: 8px 16px;
      border-radius: var(--border-radius);
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: var(--box-shadow);
    }

    .stat-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);
    }

    .stat-card {
      background: white;
      padding: var(--spacing-lg);
      border-radius: var(--border-radius);
      box-shadow: var(--box-shadow);
      display: flex;
      align-items: center;
    }

    .stat-icon {
      width: 60px;
      height: 60px;
      border-radius: var(--border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-right: var(--spacing-md);
    }

    .stat-info { flex: 1; }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #333;
    }

    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }

    .chart-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: var(--spacing-lg);
    }

    .chart-card {
      background: white;
      padding: var(--spacing-lg);
      border-radius: var(--border-radius);
      box-shadow: var(--box-shadow);
    }

    .chart-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: var(--spacing-md);
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="prototype-badge">🚧 原型演示</div>

    <h1 style="margin-bottom: 24px; color: #333;">数据仪表盘</h1>

    <!-- 统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card" v-for="card in statsCards" :key="card.title">
        <div class="stat-icon" :style="{ background: card.bgColor, color: card.color }">
          {{ card.icon }}
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-label">{{ card.title }}</div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="chart-row">
      <div class="chart-card">
        <div class="chart-title">📈 访问趋势</div>
        <div ref="lineChart" style="height: 300px;"></div>
      </div>

      <div class="chart-card">
        <div class="chart-title">📊 用户来源</div>
        <div ref="pieChart" style="height: 300px;"></div>
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/element-plus"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  
  <script>
    const { createApp, ref, onMounted } = Vue;

    createApp({
      setup() {
        const lineChart = ref(null);
        const pieChart = ref(null);

        const statsCards = [
          {
            title: '总用户',
            value: '12,345',
            icon: '👥',
            color: '#1890ff',
            bgColor: 'rgba(24, 144, 255, 0.1)'
          },
          {
            title: '总订单',
            value: '8,976',
            icon: '📦',
            bgColor: 'rgba(82, 196, 26, 0.1)',
            color: '#52c41a'
          },
          {
            title: '总收入',
            value: '¥234,567',
            icon: '💰',
            bgColor: 'rgba(250, 173, 20, 0.1)',
            color: '#faad14'
          },
          {
            title: '访问量',
            value: '56,789',
            icon: '📊',
            bgColor: 'rgba(255, 77, 79, 0.1)',
            color: '#ff4d4f'
          }
        ];

        onMounted(() => {
          // 折线图
          const lineChartInstance = echarts.init(lineChart.value);
          lineChartInstance.setOption({
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
              type: 'category',
              data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
            },
            yAxis: { type: 'value' },
            series: [{
              data: [820, 932, 901, 934, 1290, 1330, 1320],
              type: 'line',
              smooth: true,
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                    { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
                  ]
                }
              },
              itemStyle: { color: '#1890ff' }
            }],
            tooltip: { trigger: 'axis' }
          });

          // 饼图
          const pieChartInstance = echarts.init(pieChart.value);
          pieChartInstance.setOption({
            series: [{
              type: 'pie',
              radius: '60%',
              data: [
                { value: 1048, name: '搜索引擎' },
                { value: 735, name: '直接访问' },
                { value: 580, name: '邮件营销' },
                { value: 484, name: '联盟广告' }
              ],
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
              }
            }],
            tooltip: { trigger: 'item' },
            legend: { orient: 'vertical', left: 'left' }
          });

          // 响应式
          window.addEventListener('resize', () => {
            lineChartInstance.resize();
            pieChartInstance.resize();
          });
        });

        return {
          statsCards,
          lineChart,
          pieChart
        };
      }
    }).use(ElementPlus).mount('#app');
  </script>
</body>
</html>
```

---

## 示例 3: 表单提交

**文件位置**: `docs/prototype/config-form/index.html`

[此处省略完整代码，结构类似示例 1，包含表单验证、文件上传、颜色选择等组件]

---

## 快速生成技巧

### 1. 复制基础模板

从 SKILL.md 复制管理后台或移动端基础模板。

### 2. 添加业务逻辑

在 `setup()` 中添加 reactive 数据和方法。

### 3. 使用 Element Plus 组件

参考 [Element Plus 文档](https://element-plus.org/)，直接使用组件。

### 4. 模拟数据

使用 `localStorage` 实现数据持久化：

```javascript
// 保存
localStorage.setItem('key', JSON.stringify(data));

// 读取
const data = JSON.parse(localStorage.getItem('key') || '[]');
```

### 5. 添加延迟效果

模拟网络请求：

```javascript
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

const fetchData = async () => {
  loading.value = true;
  await delay();
  // 处理数据
  loading.value = false;
};
```

---

## 原型优化建议

### 性能优化

- 使用 CDN 的压缩版本（`.min.js`）
- 图表懒加载（仅在需要时初始化）
- 避免复杂计算

### 用户体验

- 添加 loading 状态
- 提供操作反馈（ElMessage）
- 合理的延迟（模拟真实网络）

### 代码组织

- 保持单文件结构
- 使用注释分隔区块
- 命名清晰易懂
