# 浮盈 app 发布流程

## 官网

推送 `main` 分支后，GitHub Actions 会自动发布 `docs/` 下的网站：

```text
https://zyhxiamo.github.io/floating-profit-app/
```

首次使用时，需要在 GitHub 仓库打开：

```text
Settings -> Pages -> Source: GitHub Actions
```

## Windows 下载包

本地生成绿色独立版：

```powershell
.\生成绿色独立版.bat
```

正式发布时，推送版本标签：

```powershell
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions 会自动打包并上传到 Releases。官网按钮始终指向最新版本下载页。

## 用户反馈

用户可以通过应用标题栏的“议”打开在线反馈页。维护时在仓库的 Issues 页面查看、回复和整理意见。
