/**
 * 结果报告模块
 * 负责格式化和显示检查结果
 */

/**
 * 显示检查结果
 */
export function displayResults(results, passedCount, totalFiles) {
  console.log(`\n📊 检查完成: ${passedCount}/${totalFiles} 个文件通过`);
  
  // 统计各类问题
  const issueStats = {};
  for (const result of results) {
    if (!result.passed && result.results) {
      for (const checkResult of result.results) {
        if (!checkResult.passed) {
          const issueType = checkResult.message.split(':')[0];
          issueStats[issueType] = (issueStats[issueType] || 0) + 1;
        }
      }
    }
  }
  
  if (Object.keys(issueStats).length > 0) {
    console.log('\n📈 问题统计:');
    for (const [issueType, count] of Object.entries(issueStats)) {
      console.log(`   ${issueType}: ${count}个文件`);
    }
  }
  
  if (passedCount === totalFiles) {
    console.log('\n🎉 所有文件都符合代码风格要求！');
    return true;
  } else {
    console.log('\n💡 请修复上述问题后重新运行检查');
    console.log('💡 使用 npm run code-style:fix 自动修复格式问题');
    return false;
  }
}

/**
 * 显示文件检查过程中的问题
 */
export function displayFileIssue(result) {
  console.log(`❌ ${result.file}`);
  if (result.error) {
    console.log(`   错误: ${result.error}`);
  } else {
    for (const checkResult of result.results) {
      if (!checkResult.passed) {
        console.log(`   ⚠️  ${checkResult.message}`);
      }
    }
  }
}

/**
 * 显示进度信息
 */
export function showProgress(current, total) {
  if (current % 5 === 0 || current === total) {
    console.log(`⏳ 进度: ${current}/${total} (${Math.round(current/total*100)}%)`);
  }
}

/**
 * 显示文件列表
 */
export function displayFileList(files) {
  console.log(`📁 找到 ${files.length} 个文件需要检查\n`);
  console.log('文件列表:', files.slice(0, 5), files.length > 5 ? '...' : '');
}
