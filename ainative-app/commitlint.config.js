module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能
        "fix", // 修复bug
        "docs", // 文档修改
        "style", // 代码格式修改，不影响代码逻辑
        "refactor", // 重构代码，不包括 bug 修复、功能新增
        "perf", // 性能优化
        "test", // 测试相关
        "chore", // 构建过程或辅助工具的变动
        "revert", // 回滚到上一个版本
        "ci", // CI配置相关
        "build", // 构建系统或外部依赖项更改
        "wip" // 进行中的工作
      ]
    ],
    "type-case": [2, "always", "lowercase"],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 200]
  }
}
