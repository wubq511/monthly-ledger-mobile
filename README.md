# 月度账本移动应用

## 项目简介

月度账本是一款移动应用程序，旨在帮助用户轻松管理每月的收入和支出。通过直观的界面和强大的功能，用户可以快速记录、分类和分析财务数据，从而更好地掌控个人财务状况。

## 功能特点

- **收入与支出记录**：快速添加和编辑收入与支出条目。
- **分类管理**：支持多种分类（如食品、交通、娱乐等），方便用户对账目进行分类统计。
- **图表分析**：通过图表直观展示财务数据，帮助用户了解消费趋势。
- **数据同步**：支持数据的备份与恢复，确保数据安全。

## 文件结构

```
.
├── app.json
├── App.tsx
├── eas.json
├── index.ts
├── package.json
├── tsconfig.json
├── android/
│   ├── build.gradle
│   ├── gradle.properties
│   ├── gradlew
│   ├── gradlew.bat
│   ├── settings.gradle
│   └── app/
│       ├── build.gradle
│       ├── proguard-rules.pro
│       └── src/
│           ├── debug/
│           ├── debugOptimized/
│           └── main/
├── assets/
├── src/
│   ├── components/
│   │   ├── Charts.tsx
│   │   └── ExpenseForm.tsx
│   ├── constants/
│   │   └── categories.ts
│   ├── hooks/
│   │   └── useLedgerData.ts
│   ├── lib/
│   │   ├── database.ts
│   │   ├── date.ts
│   │   ├── format.ts
│   │   └── ledgerSummary.ts
│   └── types/
│       └── ledger.ts
```

## 环境配置

### 系统要求

- Node.js >= 14.x
- npm >= 6.x
- Android Studio（用于运行 Android 模拟器）

### 安装依赖

1. 克隆项目：

   ```bash
   git clone <仓库地址>
   cd monthly-ledger-mobile
   ```

2. 安装依赖：

   ```bash
   npm install
   ```

### 运行项目

1. 启动开发服务器：

   ```bash
   npm start
   ```

2. 运行 Android 模拟器：

   ```bash
   npm run android
   ```

## 贡献指南

欢迎对本项目进行贡献！请遵循以下步骤：

1. Fork 本仓库。
2. 创建新分支：`git checkout -b feature/your-feature-name`。
3. 提交更改：`git commit -m 'Add some feature'`。
4. 推送到分支：`git push origin feature/your-feature-name`。
5. 提交 Pull Request。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。