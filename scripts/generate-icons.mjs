/**
 * 图标生成脚本
 * 使用 electron-icon-builder 从 PNG 生成所有平台所需的图标
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 检查 sharp 是否可用（用于 SVG 转 PNG）
let sharp;
try {
  sharp = (await import('sharp')).default;
  console.log('✓ sharp 模块已加载');
} catch (error) {
  console.error('✗ 需要安装 sharp 模块来转换 SVG 到 PNG');
  console.error('请运行：npm install -D sharp');
  process.exit(1);
}

const inputSvg = path.join(__dirname, '../resources/icons/terminal.svg');
const outputDir = path.join(__dirname, '../resources/icons');
const tempPng = path.join(outputDir, 'temp-1024.png');

async function generateIcons() {
  try {
    console.log('开始生成图标...');
    console.log('输入文件:', inputSvg);
    console.log('输出目录:', outputDir);

    // 步骤 1: 将 SVG 转换为 1024x1024 的 PNG
    console.log('\n1. 转换 SVG 为 PNG (1024x1024)...');
    await sharp(inputSvg)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(tempPng);
    console.log('✓ PNG 生成成功:', tempPng);

    // 步骤 2: 使用 electron-icon-builder 生成所有图标
    console.log('\n2. 使用 electron-icon-builder 生成各平台图标...');
    
    const iconBuilderPath = path.join(__dirname, '../node_modules/.bin/electron-icon-builder.cmd');
    const command = `"${iconBuilderPath}" --input="${tempPng}" --output="${outputDir}"`;
    
    console.log('执行命令:', command);
    execSync(command, { stdio: 'inherit' });
    
    console.log('✓ 所有图标生成成功！');

    // 清理临时文件
    console.log('\n3. 清理临时文件...');
    fs.unlinkSync(tempPng);
    console.log('✓ 临时 PNG 已删除');

    console.log('\n生成的图标文件:');
    const files = fs.readdirSync(outputDir);
    files.forEach(file => {
      if (file !== 'terminal.svg' && file !== 'README.md') {
        console.log('  -', file);
      }
    });

  } catch (error) {
    console.error('✗ 生成图标失败:', error.message);
    process.exit(1);
  }
}

generateIcons();
