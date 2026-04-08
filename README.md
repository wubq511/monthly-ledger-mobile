# 月度账本移动应用

一个基于 Expo + React Native 的本地账本应用，聚焦“按月记账、按月复盘、按趋势查看消费变化”。

## 当前版本

- 应用版本：`1.0.6`
- Android 包名：`com.h.monthlyledger`
- 数据存储：本地 SQLite

## 已实现功能

- 概览页
  - 查看当月总支出、预算状态、累计超支、综合超支情况
  - 查看本月分类消费排名与本月账单列表
  - 支持点击账单删除错误记录
- 记账页
  - 快速录入月份、金额、大类、细分和备注
  - 连续录入模式：保存后自动切换到下一个大类，最后一个大类保存后回到概览
  - 顶部提供“账单备份与导入”入口，以浮窗方式进行 JSON 备份和恢复
  - 键盘弹起时保存按钮会跟随键盘高度调整位置，减少遮挡
- 趋势页
  - 查看 6 个月支出曲线与峰值
  - 左右滑动图表窗口，继续查看更早或更晚月份
  - 查看超支月份排名、每月预算状态、同分类跨月排名

## 技术栈

- Expo SDK 54
- React Native 0.81
- TypeScript
- expo-sqlite
- react-native-svg
- Vitest

## 本地开发

### 环境要求

- Node.js 18+
- npm 9+
- Android Studio
- Android SDK / adb

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm start
```

如果是已安装 dev client 的 Android 真机：

```bash
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --host localhost --port 8081
```

### 常用命令

```bash
npm test
npx tsc --noEmit
npm run android
```

## Android 打包

### 本地 release APK

```bash
cd android
.\gradlew.bat assembleRelease
```

生成物默认位于：

```text
android/app/build/outputs/apk/release/app-release.apk
```

### 安装到已连接手机

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## 签名说明

当前仓库的 `release` 构建仍使用 `android/app/debug.keystore` 进行签名，适合本地分发和装机测试。

如果要用于应用市场正式发布，需要替换为你自己的发布 keystore，并更新 `android/app/build.gradle` 中的 `signingConfigs.release`。

## 目录概览

```text
.
├── App.tsx
├── app.json
├── assets/
├── android/
├── docs/
│   └── superpowers/
├── src/
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── lib/
│   └── types/
└── package.json
```

## 测试

```bash
npm test
npx tsc --noEmit
```
