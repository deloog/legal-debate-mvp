# 项目多版本文件清理计划

## 谨慎清理原则
1. **先备份再删除** - 所有删除的文件先移到 archive/multi-version-backup/
2. **保留最新版本** - 保留功能最完整的版本
3. **核实功能差异** - 确认不同版本是功能迭代而非不同用途
4. **测试验证** - 删除后运行完整测试确保不影响生产代码

---

## 第一类：明显的多版本文件（安全删除）

### 1. 数据库连接测试（2组）
| 文件 | 大小 | 操作 | 理由 |
|------|------|------|------|
| `test-db-connection.js` | 0.7 KB | **删除** | JS版本，功能被TS版本覆盖 |
| `test-db-connection-simple.ts` | 0.7 KB | **删除** | 简单版，功能被完整版覆盖 |
| `test-connection-pool.ts` | 16.4 KB | **保留** | 功能最完整（连接池测试） |

### 2. DeepSeek连接测试（2组）
| 文件 | 大小 | 操作 | 理由 |
|------|------|------|------|
| `test-deepseek-connection.mjs` | 1.2 KB | **删除** | ESM版本，功能与TS版重复 |
| `test-deepseek-connection.ts` | 1.2 KB | **保留** | 标准TS版本 |

### 3. 内存Agent覆盖率（2组）
| 文件 | 大小 | 操作 | 理由 |
|------|------|------|------|
| `get-memory-agent-coverage.js` | 1.8 KB | **删除** | JS版本，功能被MJS版覆盖 |
| `get-memory-agent-coverage.mjs` | 3.6 KB | **保留** | ESM版本功能更完整 |

### 4. 文档准确率测试（3个版本）
| 文件 | 大小 | 操作 | 理由 |
|------|------|------|------|
| `test-document-accuracy.ts` | 13.8 KB | **删除** | 基础版 |
| `test-document-accuracy-improved.ts` | 17.5 KB | **删除** | 改进版（中间版本） |
| `test-document-accuracy-final.ts` | 18.0 KB | **保留** | 最终版，功能最完整 |

---

## 第二类：疑似重复但需核实

### 5. 覆盖率分析工具
```
analyze-coverage.mjs          1.4 KB
analyze-existing-coverage.mjs 13.4 KB  - 需核实：是否针对现有代码
check-coverage.ts             1.6 KB   - 基础检查
check-coverage-gate.ts        12.0 KB  - 门限检查
debug-coverage-structure.mjs  1.1 KB   - 调试用途
diagnose-all-coverage.mjs     19.0 KB  - 诊断工具
get-coverage-simple.mjs       2.1 KB   - 简单获取
monitor-test-coverage.ts      12.4 KB  - 监控用途
track-coverage-history.ts     12.6 KB  - 历史追踪
```

**初步判断**：这些文件功能不同，暂不删除，但需进一步核实

### 6. 数据库检查工具
```
check-db.ts          1.4 KB
check-db-simple.ts   1.4 KB  - 核实：是否只是简化版
check-db-status.ts   2.6 KB  - 核实：是否专门检查状态
```

**初步判断**：可能功能不同，需查看内容后决定

---

## 第三类：功能不同的文件（建议保留）

### 7. API/AI调试（功能不同）
```
debug-ai-response.ts      2.2 KB  - AI响应调试
debug-api-response.ts     3.3 KB  - API响应调试
```
**结论**：功能不同，都保留

### 8. DeepSeek功能测试（功能不同）
```
test-deepseek-connection.ts   1.2 KB  - 连接测试
test-deepseek-debate.ts       13.7 KB - 辩论功能
test-deepseek-optimized.ts    15.9 KB - 优化版本
diagnose-deepseek-connection.ts 6.4 KB - 诊断工具
```
**结论**：功能不同，都保留

### 9. AI测试（功能不同）
```
test-ai-extraction-only.ts    5.0 KB  - 提取测试
test-ai-fixes.ts              10.0 KB - 修复测试
test-ai-generalization.ts     6.0 KB  - 泛化测试
test-ai-poc.ts                19.5 KB - PoC测试
```
**结论**：功能不同，都保留

### 10. 法律数据检查（功能不同）
```
check-duplicate-laws.ts   2.3 KB  - 重复检查
check-law-quality.ts      5.5 KB  - 质量检查
check-laws-status.ts      0.9 KB  - 状态检查
```
**结论**：功能不同，都保留

---

## 清理执行计划

### Phase 1：安全删除明显的重复版本
- [ ] 1. 备份所有待删除文件到 `archive/multi-version-backup/`
- [ ] 2. 删除数据库连接测试重复版本（2个）
- [ ] 3. 删除DeepSeek连接测试重复版本（1个）
- [ ] 4. 删除内存Agent覆盖率重复版本（1个）
- [ ] 5. 删除文档准确率测试中间版本（2个）
- [ ] 6. 运行测试验证

### Phase 2：核实后删除
- [ ] 1. 核实覆盖率工具功能差异
- [ ] 2. 核实数据库检查工具功能差异
- [ ] 3. 根据核实结果决定是否删除

### Phase 3：最终验证
- [ ] 1. 运行完整测试套件
- [ ] 2. 验证生产代码不受影响
- [ ] 3. 更新清理文档

---

## 预期清理效果

| 类别 | 文件数 | 大小 |
|------|--------|------|
| Phase 1 删除 | 6 个文件 | ~33 KB |
| Phase 2 可能删除 | 2-3 个文件 | ~3 KB |
| **总计** | **6-9 个文件** | **~36 KB** |

---

## 注意事项

1. **不要删除的文件类型**：
   - 生产环境使用的脚本
   - CI/CD 流程中使用的脚本
   - 文档中引用的示例脚本

2. **必须保留的文件**：
   - `jest.test-env.ts` - 测试环境配置
   - `eslint.config.mjs` 和 `eslint.config.quick.mjs` - 不同用途的ESLint配置

3. **删除前必须**：
   - 确认文件不在 .github/workflows 中被引用
   - 确认文件不在 package.json scripts 中被引用
   - 确认文件不被其他脚本导入
