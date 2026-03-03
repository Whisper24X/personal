---
name: code-review-ainative
description: 检查和修复 ainative 项目代码规范问题。覆盖 TypeScript、Vue、Go 等多语言规范检查。当提交代码前需要规范检查、CI/CD 流水线报错、代码 Review 或代码质量优化时使用。
---

# ainative 代码规范检查与修复 Skill

## 技能用途

当需要检查和修复 ainative 项目代码规范问题时使用此技能。

**触发条件**:

- 提交代码前的规范检查
- CI/CD 流水线报错
- 代码 Review 要求
- 代码质量优化

## 技能步骤

### 1. 前端项目规范检查 (app/shadow)

#### 1.1 ESLint 检查

**检查所有文件**:

```bash
# ainative-app
cd ainative-app
pnpm lint

# ainative-shadow
cd ainative-shadow
pnpm lint
```

**自动修复**:

```bash
pnpm lint:fix
```

**检查特定文件**:

```bash
pnpm eslint src/pages/xxx/index.vue
```

#### 1.2 TypeScript 类型检查

```bash
# ainative-app
pnpm type-check

# ainative-shadow
pnpm type-check
```

**常见类型错误及修复**:

```typescript
// ❌ 错误: 使用 any
const data: any = {}

// ✅ 正确: 使用具体类型
const data: Api.Module.Item = {}

// ❌ 错误: 隐式 any
function handleClick(event) {}

// ✅ 正确: 明确类型
function handleClick(event: Event) {}

// ❌ 错误: 可能为 null
const value = data.value.toString()

// ✅ 正确: 使用可选链
const value = data.value?.toString()
```

#### 1.3 样式规范检查

```bash
# ainative-shadow
pnpm lint:stylelint
```

**修复样式问题**:

```bash
pnpm lint:stylelint --fix
```

#### 1.4 代码格式化

```bash
# 使用 Prettier 格式化
pnpm format

# 检查格式是否符合规范
pnpm format:check
```

### 2. 后端项目规范检查 (backend)

#### 2.1 Go Lint 检查

```bash
cd ainative-backend
make lint
```

**常见问题及修复**:

```go
// ❌ 错误: 未处理错误
result, _ := fetchData()

// ✅ 正确: 正确处理错误
result, err := fetchData()
if err != nil {
    return nil, err
}

// ❌ 错误: 变量未使用
func example() {
    unused := "test"
    // ...
}

// ✅ 正确: 删除未使用的变量或使用它
func example() {
    // 删除 unused 变量
}

// ❌ 错误: 函数过长/复杂度过高
func handleRequest() {
    // 200+ 行代码
}

// ✅ 正确: 拆分函数
func handleRequest() {
    validateParams()
    processData()
    saveResult()
}
```

#### 2.2 代码格式化

```bash
# 使用 gofmt 格式化
gofmt -w .

# 使用 goimports (自动管理 import)
goimports -w .

# 使用 gci (import 排序)
make gci
```

#### 2.3 安全检查

```bash
# gosec 安全扫描
make gosec
```

**常见安全问题**:

```go
// ❌ 不安全: SQL 注入风险
query := fmt.Sprintf("SELECT * FROM users WHERE name='%s'", name)

// ✅ 安全: 使用参数化查询
db.Where("name = ?", name).Find(&users)

// ❌ 不安全: 密码明文存储
user.Password = password

// ✅ 安全: 密码加密
user.Password = hashPassword(password)
```

### 3. 通用代码规范

#### 3.1 命名规范

**前端 (TypeScript/Vue)**:

```typescript
// ✅ 组件名: PascalCase
export default defineComponent({
  name: "UserList",
})

// ✅ 变量/函数: camelCase
const userName = "test"
function getUserInfo() {}

// ✅ 常量: UPPER_SNAKE_CASE
const MAX_COUNT = 100

// ✅ 类型: PascalCase
interface UserInfo {}
type UserId = string

// ✅ 私有属性: 以 _ 开头
class Example {
  private _internalState: string
}
```

**后端 (Go)**:

```go
// ✅ 导出函数/变量: PascalCase
func GetUserList() {}
var MaxCount = 100

// ✅ 私有函数/变量: camelCase
func getUserById() {}
var defaultSize = 10

// ✅ 常量: PascalCase 或 camelCase
const MaxRetries = 3
const defaultTimeout = 30

// ✅ 接口名: 通常以 er 结尾
type Reader interface {}
type UserRepo interface {}

// ✅ 结构体: PascalCase
type UserInfo struct {}
```

#### 3.2 注释规范

**前端**:

```typescript
/**
 * 获取用户列表
 * @param params 查询参数
 * @returns 用户列表响应
 */
export function fetchUserList(params: SearchParams): Promise<ListResponse> {
  // 实现逻辑
}

/**
 * 用户信息组件
 */
export default defineComponent({
  name: "UserInfo",
  props: {
    /** 用户 ID */
    userId: String,
    /** 是否显示详情 */
    showDetail: Boolean,
  },
})
```

**后端**:

```go
// GetUserList 获取用户列表
// 参数:
//   - ctx: 上下文
//   - req: 请求参数
// 返回:
//   - reply: 响应数据
//   - error: 错误信息
func (s *UserService) GetUserList(ctx context.Context, req *v1.UserListReq) (*v1.UserListReply, error) {
    // 实现逻辑
}

// UserRepo 用户数据访问接口
type UserRepo interface {
    // List 获取用户列表
    List(ctx context.Context, params *UserListParams) ([]*User, int64, error)
}
```

#### 3.3 代码组织

**前端文件组织**:

```
src/pages/user/
├── index.vue              # 主页面
├── service.ts             # API 调用
├── service.type.ts        # 类型定义
├── constants.ts           # 常量定义
├── utils.ts               # 工具函数
└── components/            # 页面组件
    ├── UserForm.vue
    └── UserDetail.vue
```

**后端文件组织**:

```
internal/
├── service/               # Service 层
│   └── shadow_v1_user.go
├── biz/                   # Biz 层
│   ├── biz.go            # 接口定义
│   └── shadow_v1_user.go  # UseCase 实现
└── data/                  # Data 层
    ├── user.go            # Repository 实现
    └── gorm/              # GORM 生成代码
```

### 4. Git Commit 规范

#### 4.1 Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**:

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整 (不影响功能)
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**:

```bash
# ✅ 好的 commit
git commit -m "feat(user): 添加用户列表导出功能"
git commit -m "fix(order): 修复订单计算错误"
git commit -m "docs(readme): 更新安装说明"

# ❌ 不好的 commit
git commit -m "修改"
git commit -m "update"
git commit -m "fix bug"
```

#### 4.2 使用 Commitlint

项目已配置 commitlint,提交时会自动检查:

```bash
# 如果 commit message 不符合规范,会报错
git commit -m "update code"  # ❌ 会被拒绝

# 正确的提交
git commit -m "feat(user): 添加用户搜索功能"  # ✅ 通过
```

### 5. 代码审查 Checklist

#### 5.1 通用检查项

- [ ] 代码符合 ESLint/Go Lint 规范
- [ ] 没有 TypeScript 类型错误
- [ ] 所有变量和函数都有清晰的命名
- [ ] 关键逻辑有注释说明
- [ ] 没有硬编码的配置信息
- [ ] 错误处理完善
- [ ] 日志记录合理

#### 5.2 前端检查项

- [ ] 组件拆分合理
- [ ] Props 和 Emits 有类型定义
- [ ] API 调用有错误处理
- [ ] Loading 和 Empty 状态处理
- [ ] 样式使用 scoped
- [ ] 没有内存泄漏 (移除事件监听)
- [ ] 路由跳转正确
- [ ] 权限控制正确

#### 5.3 后端检查项

- [ ] 分层清晰 (Service/Biz/Data)
- [ ] 接口定义在 Biz 层
- [ ] DTO 转换正确
- [ ] SQL 查询使用参数化
- [ ] 事务处理正确
- [ ] 并发安全
- [ ] 资源正确释放
- [ ] 日志级别合理

### 6. 自动化检查

#### 6.1 Pre-commit Hook

项目已配置 husky pre-commit hook,提交前会自动执行:

```bash
# ainative-app / ainative-shadow
# .husky/pre-commit
pnpm lint-staged
```

**lint-staged 配置** (package.json):

```json
{
  "lint-staged": {
    "*.{js,ts,vue}": ["eslint --fix", "prettier --write"],
    "*.{css,less,scss}": ["prettier --write"]
  }
}
```

#### 6.2 CI/CD 检查

在 GitLab CI 中会自动执行:

```yaml
# .gitlab-ci.yml
lint:
  stage: test
  script:
    - pnpm install
    - pnpm lint
    - pnpm type-check
```

### 7. 常见问题修复

#### 7.1 ESLint 常见错误

```typescript
// Error: 'xxx' is defined but never used
// 修复: 删除未使用的变量或添加 eslint-disable

// Error: Missing return type on function
// 修复: 添加返回类型
function example(): void {}

// Error: Unexpected console statement
// 修复: 使用 logger 或添加注释
// eslint-disable-next-line no-console
console.log("debug info")
```

#### 7.2 TypeScript 常见错误

```typescript
// Error: Object is possibly 'null'
// 修复: 使用可选链或类型守卫
const value = data?.value
if (data) {
  const value = data.value
}

// Error: Type 'xxx' is not assignable to type 'yyy'
// 修复: 使用类型断言或修正类型
const data = response as Api.Response
```

#### 7.3 Go Lint 常见错误

```go
// Error: error return value not checked
// 修复: 检查错误
if err := doSomething(); err != nil {
    return err
}

// Error: exported function should have comment
// 修复: 添加注释
// GetUserList 获取用户列表
func GetUserList() {}
```

### 8. 快速修复命令

```bash
# 前端一键修复
cd ainative-app  # 或 ainative-shadow
pnpm lint:fix && pnpm format

# 后端一键修复
cd ainative-backend
make gci && gofmt -w .
```

## 相关文档

- [ESLint 配置](https://eslint.org/)
- [TypeScript 规范](https://www.typescriptlang.org/)
- [Go Code Review](https://github.com/golang/go/wiki/CodeReviewComments)
- [Conventional Commits](https://www.conventionalcommits.org/)
