
### 禁令

1. 永远不要认为写完代码编译运行通过就结束思考，要跑测试用例。
2. 永远不要写有类型错误的不安全代码，Vue项目用 `npx vue-tsc --noEmit` 检查，纯TS用 `npx tsc --noEmit`。
3. 写完代码要检查，一定不要有乱码存在。
4. 不要写多余代码，只写必要的代码。
5. 永远不要吞没报错日志，要打印出来。
6. 永远不要用C盘的文件路径，写测试用例。使用D盘的文件路径。
7. 打开终端powershell后,先切换编码再运行命令,切换编码: `$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;chcp 65001`
8. 永远不要使用require,用import导入模块。
