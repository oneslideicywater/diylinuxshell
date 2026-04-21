/**
 * SFTP 本地文件操作模块
 * 提供本地文件操作的常量定义
 * 状态管理已迁移至 @/stores/sftpBrowser (Pinia Store)
 * @module sftp/local
 */

/**
 * 盘符列表视图的特殊路径标识
 * Windows 平台：从盘符根目录继续向上导航时显示所有盘符
 */
export const DRIVES_PATH = '此电脑'

/**
 * 导出 Pinia Store 供组件使用
 * 所有状态管理（localPath, localFiles, localFileCount）已迁移到 Store 中
 * 组件应使用 useSftpBrowserStore() 获取状态和操作方法
 */
export { useSftpBrowserStore } from '@/stores/sftpBrowser'
