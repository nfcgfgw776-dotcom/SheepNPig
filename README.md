# SheepNPig - 羊羊和猪猪的恋爱小屋

这是一个静态网页项目，适合部署到 GitHub Pages。

## 说明

- 打开页面时会显示欢迎界面
- 点击任意位置或等待 2 秒后进入时间线
- 已包含朱国轩和张炀的恋爱记录示例
- 可以选择年份、月份、日期，添加文字和照片
- 支持最早 1995 年，之后可继续添加更多记录

## 文件

- `index.html` - 页面结构
- `styles.css` - 页面样式
- `script.js` - 交互逻辑

## 部署方式

1. 将本目录上传到 GitHub 仓库（推荐仓库名 `SheepNPig`）
2. 在仓库设置中启用 GitHub Pages，选择 `main` 分支和根目录
3. 页面即可通过 GitHub Pages 访问

## 跨设备同步说明

当前页面已支持与 Firebase Realtime Database 同步。要实现手机、电脑、所有访问者看到相同最新内容：

1. 创建一个 Firebase 项目并添加 Web 应用
2. 启用 Realtime Database
3. 设定数据库规则为：

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

4. 将 Firebase 项目的配置填入 `firebase-config.js`
5. 上传并刷新页面，所有访问者将从 Firebase 读取并同步最新修改

如果你不希望使用 Firebase，同步将退回为本地浏览器存储，只能在本机上看到修改。