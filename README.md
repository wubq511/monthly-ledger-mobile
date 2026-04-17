# 拾账移动应用

一个基于 Expo + React Native 的本地账本应用，聚焦“按月统计、快速记账、长期复盘”。

## 当前版本

- 应用版本：`1.0.9`
- Android 包名：`com.h.monthlyledger`
- 数据存储：本地 SQLite

## 已实现功能

- 概览页
  - 查看当月总支出、预算状态、累计超支、综合超支情况
  - 查看本月分类消费排名与本月账单列表
  - 支持点击账单删除错误记录
- 记账页
  - 支持 `月模式 / 日模式`
  - 月模式保持按月录入
  - 日模式支持记录到具体日期，概览账单会显示实际记账日期
  - 保存后自动切换到下一个大类，最后一个大类保存后回到概览
  - 顶部提供统一的“账本设置”入口
  - Android 返回手势或返回键在“记账 / 趋势”页会先回到概览页
- 账本设置
  - 支持切换月模式和日模式
  - 支持设置默认月预算
  - 支持按月份设置单独预算
  - 分类管理、备份与导入统一整合到同一个入口
- 分类管理
  - 支持新增、改名、删除大类与细分
  - 支持大类和细分拖拽排序
  - 细分默认收起，可按需展开
  - 新增/改名输入框会悬浮在键盘上方
- 备份与导入
  - 支持导出 JSON 备份
  - 支持从备份合并导入或覆盖恢复
  - 备份文件同时包含账单、分类、预算和记账模式
- 趋势页
  - 查看 6 个月支出曲线与峰值
  - 左右滑动图表窗口查看更早或更晚月份
  - 查看超支月份排名、每月预算状态、同分类跨月排名

## 技术栈

- Expo SDK 54
- React Native 0.81
- TypeScript
- expo-sqlite
- react-native-gesture-handler
- react-native-draggable-flatlist
- react-native-reanimated
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
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

生成物默认位于：

```text
android/app/build/outputs/apk/release/app-release.apk
```

如果要作为发布附件分发，建议重命名为：

```text
android/app/build/outputs/apk/release/monthly-ledger-mobile-v1.0.9-release.apk
```

### 安装到已连接手机

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### 已发布版本

- GitHub Releases：[v1.0.9](https://github.com/wubq511/monthly-ledger-mobile/releases/tag/v1.0.9)
- APK 下载：[monthly-ledger-mobile-v1.0.9-release.apk](https://github.com/wubq511/monthly-ledger-mobile/releases/download/v1.0.9/monthly-ledger-mobile-v1.0.9-release.apk)

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
