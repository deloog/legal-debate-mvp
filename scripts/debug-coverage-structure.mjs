import fs from 'fs';
import path from 'path';

const coverageFile = path.join(
  process.cwd(),
  'coverage',
  'coverage-final.json'
);
const data = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));

// 查找一个planning-agent文件
const files = Object.keys(data).filter(k => k.includes('planning-agent'));
if (files.length > 0) {
  const filePath =
    files.find(f => f.includes('workflow-orchestrator')) || files[0];
  const fileData = data[filePath];

  console.log('File:', filePath);
  console.log('\nKeys:', Object.keys(fileData));
  console.log('\ns (statements) type:', typeof fileData.s);
  console.log('s keys sample:', Object.keys(fileData.s).slice(0, 5));
  console.log('s values sample:', Object.values(fileData.s).slice(0, 5));
  console.log('s total lines:', Object.keys(fileData.s).length);

  console.log(
    '\nst (statement map) keys:',
    fileData.st ? Object.keys(fileData.st).slice(0, 3) : 'undefined'
  );
  console.log(
    '\nbranch (b) keys:',
    fileData.b ? Object.keys(fileData.b).length : 0
  );
  console.log(
    '\nfunction (f) keys:',
    fileData.f ? Object.keys(fileData.f).length : 0
  );
}
