# Commit message 与提交

根据 Git 暂存区中的改动拟定简短的中文 commit message；只有用户明确要求提交且确认 message 后，才执行提交。

## 检查暂存区

使用 `git status --short --branch`、`git diff --cached --stat` 和 `git diff --cached` 检查暂存区。commit message 只概括暂存区中的改动，不要纳入未暂存改动。暂存区为空时，说明没有可提交内容，不要自行运行 `git add`。

若暂存区包含多个不相关主题，先提醒用户拆分提交；不要用含糊摘要掩盖不相关改动。

## 拟定 message

格式为 `<type>: <中文简述>`。摘要保持简短、具体，不加句号，例如：

```text
feat: 添加用户搜索功能
fix: 修复空列表渲染异常
```

`type` 应与改动性质一致，优先使用 `feat`、`fix`、`docs`、`style`、`test` 或 `refactor`。

## 确认并提交

只要求生成 message 时，返回建议文案，不执行提交。用户要求提交时，先展示完整 message 并明确询问是否接受；收到肯定答复后才执行：

```bash
git commit -m "<message>"
```

若用户不接受，则按反馈修改并再次确认，不得在确认前提交。
