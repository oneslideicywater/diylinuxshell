/**
 * 文件系统工具函数
 * 提供跨平台的文件路径处理等工具函数
 * @module utils/fs-utils
 */

/**
 * 路径处理工具对象
 * 提供跨平台的路径处理方法
 */
export const pathUtils = {
  /**
   * 获取目录的父目录路径（跨平台）
   * @param p - 要处理的路径
   * @returns 父目录路径
   */
  dirname: (p: string): string => {
    // 处理 Windows 路径
    if (p.includes('\\')) {
      const parts = p.split(/[/\\]/)
      if (parts.length <= 1) return p
      parts.pop()
      return parts.join('\\') || '\\'
    }
    // 处理 POSIX 路径
    const parts = p.split('/')
    if (parts.length <= 1) return p
    parts.pop()
    return parts.join('/') || '/'
  },
  
  /**
   * POSIX 风格的路径处理
   */
  posix: {
    /**
     * 获取 POSIX 路径的父目录
     * @param p - POSIX 路径
     * @returns 父目录路径
     */
    dirname: (p: string): string => {
      const parts = p.split('/')
      if (parts.length <= 1) return p
      parts.pop()
      return parts.join('/') || '/'
    }
  }
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的大小字符串
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化字节数（用于显示）
 * @param bytes - 字节数
 * @returns 格式化后的大小字符串
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

/**
 * 格式化时间（秒）
 * @param seconds - 秒数
 * @returns 格式化后的时间字符串
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}m${secs}s`
}

/**
 * 格式化速度（字节/秒）
 * @param bytesPerSecond - 每秒字节数
 * @returns 格式化后的速度字符串
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '-'
  return formatBytes(bytesPerSecond) + '/s'
}
