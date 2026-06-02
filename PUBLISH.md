# 浮盈 app 发布流程

## 1. 生成绿色独立版

双击：

```text
生成绿色独立版.bat
```

脚本会生成两个文件：

```text
release/floating-profit-app-green-0.2.1.zip
release/floating-profit-app-green-latest.zip
```

带版本号的 ZIP 用于归档，`latest` ZIP 用于官网固定下载地址。

## 2. 发布 GitHub 备用版本

```powershell
git add .
git commit -m "发布浮盈 app 0.2.1"
git push
git tag v0.2.1
git push origin v0.2.1
```

GitHub Actions 会更新备用官网，并将 ZIP 上传到 Releases。Release 标题只显示版本号。

## 3. 首次部署国内 CloudBase 版本

1. 注册或登录腾讯云账号。
2. 创建 CloudBase 环境。
3. 复制 `cloudbase.example.json` 为 `cloudbase.local.json`，填写环境 ID、管理员邮箱、API 地址和静态托管下载地址。
4. 运行：

```powershell
npx -y -p @cloudbase/cli cloudbase login
```

5. 双击：

```text
部署国内版.bat
```

脚本会写入 CloudBase 地址、重新打包应用、部署云函数、尝试开启邮箱登录、上传官网和最新 ZIP。

## 4. CloudBase 控制台检查

- 首次上线时，在 CloudBase 控制台打开“身份认证 → 登录方式 → 邮箱验证码”，启用内置邮件代发。这个步骤只需操作一次。
- 确认数据库已创建 `reviews` 和 `metrics` 集合。云函数会自动创建缺少的集合。
- 确认 API HTTP 路径为 `/api`。
- 使用隐藏管理页审核评价：

```text
/admin/reviews.html
```

## 5. 后续版本

更新版本号、生成绿色包、推送 GitHub 标签，再运行 `部署国内版.bat`。官网固定下载地址无需修改。
