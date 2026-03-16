# AINative Workspace

研学项目主仓库，使用 Git Subtree 管理多个子项目。

## 项目结构

```
yanxue-main/
├── ainative-backend/   # Go 后端服务
├── ainative-shadow/    # 管理后台（Vue3 + Element Plus）
├── ainative-app/       # 小程序（Taro + Vue3）
├── sandbox/           # 沙箱开发环境
└── Makefile          # 统一管理脚本
```

## 快速开始

### 1. 克隆仓库

```bash
git clone https://gitlab.yc345.tv/frontend/yanxue-main.git
cd yanxue-main
```

### 2. 拉取所有子项目

```bash
make subtree-pull
```

### 3. 查看所有可用命令

```bash
make help
```

## 常用命令

### 子仓库管理

```bash
make subtree-pull          # 拉取所有子仓库
make subtree-push          # 推送所有子仓库
make subtree-status        # 查看子仓库状态
make subtree-list          # 列出子仓库配置

# 单个子仓库操作
make subtree-pull-backend  # 拉取后端代码
make subtree-pull-shadow   # 拉取管理后台代码
make subtree-pull-app      # 拉取小程序代码

make subtree-push-backend  # 推送后端代码
make subtree-push-shadow   # 推送管理后台代码
make subtree-push-app      # 推送小程序代码
```

### 沙箱环境

```bash
make sandbox           # 启动沙箱
make sandbox-build     # 构建沙箱镜像
make sandbox-stop      # 停止沙箱
make sandbox-shell     # 进入沙箱终端
make sandbox-logs      # 查看沙箱日志
make sandbox-clean     # 清理沙箱
make sandbox-restart   # 重启沙箱
```

## 子项目说明

| 子项目 | 说明 | 技术栈 |
|--------|------|--------|
| ainative-backend | 后端服务 | Go + Gin + GORM |
| ainative-shadow | 管理后台 | Vue3 + Element Plus + Pinia |
| ainative-app | 小程序 | Taro + Vue3 + 微信小程序 |

详细开发文档见各子项目的 README。

## 开发流程

### 典型工作流

```bash
# 1. 拉取最新代码
make subtree-pull

# 2. 在子项目中开发
cd ainative-app
# ... 进行开发 ...

# 3. 提交并推送子项目
git add .
git commit -m "feat: 新功能"
cd ..
make subtree-push-app

```

### 推送到 Feature 分支

```bash
# 推送到指定的 feature 分支（分支名必须以 feature/ 开头）
make subtree-push-backend feature/new-api
make subtree-push-shadow feature/ui-update
make subtree-push-app feature/payment
```

## 注意事项

⚠️ **重要提示**

1. **子仓库操作必须在根目录执行**：所有 `make subtree-*` 命令必须在 `yanxue-main` 根目录运行
2. **不要在 worktree 中操作**：Subtree 命令不支持 worktree
3. **推送前先拉取**：推送失败时先执行 `make subtree-pull-{name}`
4. **私钥文件不要提交**：`ainative-app/key/` 目录已在 `.gitignore` 中排除

## 获取帮助

```bash
make help              # 查看所有可用命令
make subtree-list      # 查看子仓库配置
```

---

## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.yc345.tv/frontend/yanxue-main.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.yc345.tv/frontend/yanxue-main/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
