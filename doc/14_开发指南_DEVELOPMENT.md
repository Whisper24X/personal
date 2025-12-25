# mind2build 开发指南

**文档版本**: v1.0  
**创建日期**: 2025-12-24

## 1. 开发环境搭建

### 1.1 克隆仓库
```bash
git clone https://github.com/geekan/mind2build.git
cd mind2build
```

### 1.2 创建虚拟环境
```bash
conda create -n mind2build python=3.9
conda activate mind2build
```

### 1.3 安装依赖
```bash
pip install -e ".[dev]"
pip install -e ".[test]"
```

### 1.4 安装 Pre-commit
```bash
pre-commit install
```

## 2. 代码规范

### 2.1 格式化

**Black**:
```bash
black mind2build tests
```

**isort**:
```bash
isort mind2build tests
```

### 2.2 Lint 检查

**Ruff**:
```bash
ruff check mind2build tests
```

### 2.3 类型检查

**mypy** (可选):
```bash
mypy mind2build
```

## 3. 测试

### 3.1 运行测试
```bash
# 所有测试
pytest

# 特定文件
pytest tests/test_role.py

# 特定测试
pytest tests/test_role.py::test_role_init

# 带覆盖率
pytest --cov=mind2build --cov-report=html
```

### 3.2 编写测试
```python
import pytest
from mind2build.roles import Role

def test_role_init():
    role = Role(name="Test")
    assert role.name == "Test"

@pytest.mark.asyncio
async def test_role_run():
    role = Role()
    result = await role.run()
    assert result is not None
```

## 4. 目录结构

```
mind2build/
├── mind2build/          # 源代码
│   ├── actions/      # 行动实现
│   ├── roles/        # 角色实现
│   ├── provider/     # LLM 提供商
│   ├── memory/       # 记忆系统
│   ├── tools/        # 工具
│   └── utils/        # 工具函数
├── tests/            # 测试代码
├── examples/         # 示例
└── docs/             # 文档
```

## 5. 开发工作流

### 5.1 创建分支
```bash
git checkout -b feature/my-feature
```

### 5.2 开发和提交
```bash
# 开发...
git add .
git commit -m "feat: add new feature"
```

### 5.3 推送和 PR
```bash
git push origin feature/my-feature
# 在 GitHub 创建 Pull Request
```

## 6. 调试技巧

### 6.1 日志调试
```python
import logging
logging.basicConfig(level=logging.DEBUG)

from mind2build.logs import logger
logger.debug("Debug message")
```

### 6.2 断点调试
```python
import pdb; pdb.set_trace()
```

### 6.3 VS Code 调试
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: Current File",
            "type": "python",
            "request": "launch",
            "program": "${file}",
            "console": "integratedTerminal"
        }
    ]
}
```

## 7. 贡献指南

### 7.1 提交规范

遵循 Conventional Commits:
```
feat: 新功能
fix: Bug 修复
docs: 文档更新
test: 测试相关
refactor: 重构
style: 代码风格
chore: 其他改动
```

### 7.2 代码审查清单
- [ ] 代码通过所有测试
- [ ] 代码符合规范（black/ruff）
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] Commit 信息清晰

## 8. 常用命令

```bash
# 格式化代码
make format

# 运行测试
make test

# 检查代码
make lint

# 生成文档
make docs

# 清理
make clean
```

---

**参考**: CONTRIBUTING.md
