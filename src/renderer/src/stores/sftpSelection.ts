import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * SFTP 文件选择状态管理 Store
 * 
 * 核心设计原则：
 * 1. **统一数据结构**：只使用 selectedLocals 数组（单文件时长度为1，多文件时长度>1）
 * 2. **按连接隔离**：每个 SFTP 连接（sftpConnectionId）拥有独立的选中状态
 * 3. **响应式同步**：通过 Pinia Store 实现组件间状态同步
 * 
 * 使用场景：
 * - 单文件操作：selectedLocals = ['file1.txt'] （数组长度=1）
 * - 多文件操作：selectedLocals = ['file1.txt', 'file2.txt', 'folder1'] （数组长度>1）
 */
export const useSftpSelectionStore = defineStore('sftpSelection', () => {
  /**
   * 按连接 ID 存储的选中文件路径映射表
   * key: sftpConnectionId (SFTP 连接标识符)
   * value: string[] (选中的本地文件/文件夹路径数组)
   */
  const selectionMap = ref<Map<string, string[]>>(new Map())

  /**
   * 获取指定连接的选中文件列表
   * @param connectionId SFTP 连接标识符
   * @returns 选中的文件路径数组（空数组表示未选中）
   */
  function getSelectedFiles(connectionId: string): string[] {
    return selectionMap.value.get(connectionId) || []
  }

  /**
   * 获取第一个选中的文件路径（用于单文件操作场景）
   * @param connectionId SFTP 连接标识符
   * @returns 第一个选中的文件路径，或空字符串
   */
  function getFirstSelectedFile(connectionId: string): string {
    const files = getSelectedFiles(connectionId)
    return files.length > 0 ? files[0] : ''
  }

  /**
   * 判断是否已选中文件
   * @param connectionId SFTP 连接标识符
   * @returns 是否有选中项
   */
  function hasSelection(connectionId: string): boolean {
    const files = getSelectedFiles(connectionId)
    return files.length > 0
  }

  /**
   * 判断是否为多选模式（选中多个文件）
   * @param connectionId SFTP 连接标识符
   * @returns 是否多选
   */
  function isMultiSelect(connectionId: string): boolean {
    return getSelectedFiles(connectionId).length > 1
  }

  /**
   * 设置选中文件列表（替换原有选择）
   * @param connectionId SFTP 连接标识符
   * @param paths 文件路径数组
   */
  function setSelectedFiles(connectionId: string, paths: string[]): void {
    selectionMap.value.set(connectionId, [...paths])
  }

  /**
   * 清空指定连接的选中状态
   * @param connectionId SFTP 连接标识符
   */
  function clearSelection(connectionId: string): void {
    selectionMap.value.delete(connectionId)
  }

  /**
   * 添加单个文件到选中列表（Ctrl/Cmd 点击）
   * 如果已选中则移除，未选中则添加
   * 
   * @param connectionId SFTP 连接标识符
   * @param path 文件路径
   */
  function toggleFileSelection(connectionId: string, path: string): void {
    const currentFiles = getSelectedFiles(connectionId)
    const index = currentFiles.indexOf(path)

    if (index > -1) {
      // 已选中则移除
      currentFiles.splice(index, 1)
    } else {
      // 未选中则添加
      currentFiles.push(path)
    }

    // 更新 Map（触发响应式）
    selectionMap.value.set(connectionId, [...currentFiles])
  }

  /**
   * 范围选择（Shift 点击）
   * 从上一个选中项到当前项范围内的所有文件都选中
   * 
   * @param connectionId SFTP 连接标识符
   * @param currentPath 当前点击的文件路径
   * @param allFiles 当前目录所有文件的有序列表
   * @param pathExtractor 从文件对象中提取路径的函数
   */
  function rangeSelect(
    connectionId: string,
    currentPath: string,
    allFiles: any[],
    pathExtractor: (item: any) => string
  ): void {
    const currentFiles = getSelectedFiles(connectionId)

    if (currentFiles.length === 0) {
      // 没有之前的选中项，直接选中当前项
      setSelectedFiles(connectionId, [currentPath])
      return
    }

    // 找到最后一个选中项在 allFiles 中的索引
    const lastSelectedPath = currentFiles[currentFiles.length - 1]
    const lastIndex = allFiles.findIndex(item => pathExtractor(item) === lastSelectedPath)
    
    // 找到当前点击项在 allFiles 中的索引
    const currentIndex = allFiles.findIndex(item => pathExtractor(item) === currentPath)

    if (lastIndex === -1 || currentIndex === -1) {
      // 未找到对应项，直接选中当前项
      setSelectedFiles(connectionId, [currentPath])
      return
    }

    // 确定范围（从小到大）
    const startIdx = Math.min(lastIndex, currentIndex)
    const endIdx = Math.max(lastIndex, currentIndex)

    // 提取范围内的所有路径
    const selectedPaths: string[] = []
    for (let i = startIdx; i <= endIdx; i++) {
      selectedPaths.push(pathExtractor(allFiles[i]))
    }

    // 更新选中状态
    setSelectedFiles(connectionId, selectedPaths)
  }

  /**
   * 移除指定连接的所有选中状态（关闭 SFTP 窗口时调用）
   * @param connectionId SFTP 连接标识符
   */
  function removeConnection(connectionId: string): void {
    selectionMap.value.delete(connectionId)
  }

  return {
    // 状态
    selectionMap,

    // 查询方法
    getSelectedFiles,
    getFirstSelectedFile,
    hasSelection,
    isMultiSelect,

    // 操作方法
    setSelectedFiles,
    clearSelection,
    toggleFileSelection,
    rangeSelect,
    removeConnection
  }
})
