/**
 * SFTP 远程文件操作模块
 * 提供远程文件操作的常量定义
 * 状态管理已迁移至 @/stores/sftpBrowser (Pinia Store)
 * @module sftp/remote
 */

/**
 * 导出 Pinia Store 供组件使用
 * 所有状态管理（remotePath, remoteFiles, remoteFileCount）已迁移到 Store 中
 * 组件应使用 useSftpBrowserStore() 获取状态和操作方法
 */
export { useSftpBrowserStore } from '@/stores/sftpBrowser'
