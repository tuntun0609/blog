---
name: git-workflow
description: 指导本地 Git 工作流并遵守仓库操作授权边界。当前用于根据需求或暂存区改动命名和创建分支、拟定中文 commit message，以及在用户确认后提交；后续可扩展其他 Git 操作规范。
---

# Git Workflow

根据用户要求处理本地 Git 工作流。先区分用户是只需要建议，还是要求修改仓库状态：只要求名称或文案时，不运行会创建分支、切换分支或提交代码的命令；只有用户明确要求相应操作时才执行。不要自行暂存文件，也不要推送远端。

## 功能路由

- 用户要求命名、新建或切换到新分支时，读取并遵循 [references/checkout-branch.md](references/checkout-branch.md)。
- 用户要求生成 commit message 或提交暂存区改动时，读取并遵循 [references/commit-msg.md](references/commit-msg.md)。
- 用户同时要求两项功能时，读取两个 reference，先处理分支，再拟定 commit message；提交前仍须取得 reference 要求的用户确认。

只读取当前任务需要的 reference。完成实际操作后，简要报告结果；未执行的操作不要表述为已完成。
