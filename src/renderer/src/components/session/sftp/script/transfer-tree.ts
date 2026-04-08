/**
 * SFTP 目录树节点操作工具模块
 * 提供传输节点树的创建、查找、更新等操作函数
 * @module sftp/tree
 */

import { reactive } from 'vue'
import type { TransferNode } from '@shared/types/sftp'
import { formatTime } from '@/utils/fs-utils'

/**
 * 节点 ID 计数器
 */
let nodeIdCounter = 0

/**
 * 生成唯一节点 ID
 * @returns 唯一的节点 ID 字符串
 */
export function generateNodeId(): string {
  return `node-${++nodeIdCounter}`
}

/**
 * 创建传输节点
 * @param name - 节点名称
 * @param isDirectory - 是否为目录
 * @param type - 传输类型（上传、下载、删除）
 * @param localPath - 本地路径
 * @param remotePath - 远程路径
 * @param size - 文件大小
 * @returns 传输节点对象
 */
export function createTransferNode(
  name: string,
  isDirectory: boolean,
  type: 'upload' | 'download' | 'delete',
  localPath?: string,
  remotePath?: string,
  size: number = 0
): TransferNode {
  return reactive({
    id: generateNodeId(),
    name,
    isDirectory,
    type,
    status: 'pending',
    progress: 0,
    size,
    localPath,
    remotePath,
    speed: 0,
    remaining: '-',
    elapsed: '0s',
    children: isDirectory ? [] : undefined,
    startTime: Date.now(),
    expanded: false // 默认折叠
  })
}

/**
 * 更新节点状态
 * @param nodes - 节点列表
 * @param nodeId - 节点 ID
 * @param updates - 要更新的属性
 */
export function updateNodeStatus(
  nodes: TransferNode[],
  nodeId: string,
  updates: Partial<TransferNode>
): void {
  const updateRecursive = (nodeList: TransferNode[]): boolean => {
    for (const node of nodeList) {
      if (node.id === nodeId) {
        Object.assign(node, updates)
        return true
      }
      if (node.children && updateRecursive(node.children)) {
        return true
      }
    }
    return false
  }
  updateRecursive(nodes)
}

/**
 * 检查节点的所有子节点是否都已完成
 * @param node - 传输节点
 * @returns 是否所有子节点都已完成
 */
export function areAllChildrenCompleted(node: TransferNode): boolean {
  if (!node.children || node.children.length === 0) {
    return true
  }
  
  for (const child of node.children) {
    // 如果子节点未完成，或者子节点的子节点有未完成的，返回 false
    if (child.status !== 'completed' || !areAllChildrenCompleted(child)) {
      return false
    }
  }
  
  return true
}

/**
 * 查找节点的父节点
 * @param nodes - 节点列表
 * @param targetNode - 目标节点
 * @param parentNode - 当前父节点（递归使用）
 * @returns 父节点，如果未找到则返回 null
 */
export function findParentNode(
  nodes: TransferNode[],
  targetNode: TransferNode,
  parentNode: TransferNode | null = null
): TransferNode | null {
  for (const node of nodes) {
    if (node === targetNode) {
      return parentNode
    }
    if (node.children) {
      const found = findParentNode(node.children, targetNode, node)
      if (found !== null) {
        return found
      }
    }
  }
  return null
}

/**
 * 自下而上更新节点状态：如果所有子节点都完成，则更新父节点为完成
 * 然后在父节点完成后，继续向上更新祖父节点
 * @param node - 要更新的节点
 * @param nodes - 节点列表（用于查找父节点）
 */
export function updateParentStatusRecursively(node: TransferNode, nodes: TransferNode[]): void {
  // 查找当前节点的父节点
  const parentNode = findParentNode(nodes, node)
  
  if (!parentNode) {
    // 没有父节点，不需要更新
    return
  }
  
  // 只有文件夹节点才需要检查子节点
  if (parentNode.isDirectory && parentNode.children && parentNode.children.length > 0) {
    // 检查所有子节点是否都已完成
    const allCompleted = areAllChildrenCompleted(parentNode)
    
    if (allCompleted) {
      // 所有子节点都完成了，更新当前节点为完成
      parentNode.status = 'completed'
      parentNode.progress = 100
      parentNode.elapsed = formatTime((Date.now() - (parentNode.startTime || Date.now())) / 1000)
      
      // 继续向上更新祖父节点
      updateParentStatusRecursively(parentNode, nodes)
    }
  }
}

/**
 * 查找节点（按 ID）
 * @param nodes - 节点列表
 * @param nodeId - 节点 ID
 * @returns 找到的节点，未找到返回 undefined
 */
export function findNode(nodes: TransferNode[], nodeId: string): TransferNode | undefined {
  const findRecursive = (nodeList: TransferNode[]): TransferNode | undefined => {
    for (const node of nodeList) {
      if (node.id === nodeId) return node
      if (node.children) {
        const found = findRecursive(node.children)
        if (found) return found
      }
    }
    return undefined
  }
  return findRecursive(nodes)
}

/**
 * 查找节点（按路径）
 * @param nodes - 节点列表
 * @param localPath - 本地路径
 * @returns 找到的节点，未找到返回 undefined
 */
export function findNodeByPath(nodes: TransferNode[], localPath: string): TransferNode | undefined {
  for (const node of nodes) {
    if (node.localPath === localPath) {
      return node
    }
    if (node.children) {
      const found = findNodeByPath(node.children, localPath)
      if (found) return found
    }
  }
  return undefined
}

/**
 * 更新节点进度
 * @param node - 要更新的节点
 * @param progress - 进度百分比
 * @param speed - 传输速度
 * @param nodes - 节点列表（用于触发响应式更新）
 */
export function updateNodeProgress(
  node: TransferNode,
  progress: number,
  speed: number,
  nodes: TransferNode[]
): void {
  // 直接修改节点属性，Vue 3 的响应式系统应该能检测到
  node.progress = progress
  node.speed = speed
  node.elapsed = formatTime((Date.now() - (node.startTime || Date.now())) / 1000)
  
  if (progress >= 100) {
    node.status = 'completed'
    node.progress = 100
    // 自下而上更新父节点状态
    updateParentStatusRecursively(node, nodes)
  } else {
    node.status = 'transferring'
  }
  
  // 强制触发响应式更新：重新赋值数组
  nodes.splice(0, nodes.length, ...nodes)
}

/**
 * 需要排除的系统目录和特殊目录
 */
const excludedDirs = [
  '$RECYCLE.BIN',
  'System Volume Information',
  'Config.Msi',
  '$WINDOWS.~BT',
  'Windows',
  'Program Files',
  'Program Files (x86)',
  'PerfLogs',
  'Recovery',
  'Documents and Settings',
  'MSOCache',
  'Intel',
  'AMD',
  'NVIDIA',
  '.Trash-1000',
  'lost+found'
]

/**
 * 递归扫描文件夹结构，创建传输节点树
 * @param localPath - 本地路径
 * @param remotePath - 远程路径
 * @returns 传输节点数组
 */
export async function scanFolderStructure(localPath: string, remotePath: string): Promise<TransferNode[]> {
  const nodes: TransferNode[] = []
  
  try {
    // 使用 IPC 获取文件列表
    const result = await window.api.sftp.getLocalFiles(localPath)
    console.log('获取本地文件结果:', result)
    
    if (!result.success || !result.data) {
      console.warn('获取文件失败或无数据:', result)
      return nodes
    }
    
    for (const file of result.data) {
      // 跳过父目录引用
      if (file.name === '.' || file.name === '..') {
        continue
      }
      
      // 跳过隐藏文件和系统文件（以 . 开头的文件）
      if (file.name.startsWith('.') && file.isDirectory === false) {
        continue
      }
      
      // 跳过排除的系统目录
      if (file.isDirectory && excludedDirs.includes(file.name)) {
        console.log('跳过系统目录:', file.path)
        continue
      }
      
      const entryLocalPath = file.path
      const entryRemotePath = `${remotePath}/${file.name}`
      const isDirectory = file.isDirectory
      
      console.log('处理文件:', file.name, isDirectory ? '(文件夹)' : '(文件)')
      
      const node = createTransferNode(
        file.name,
        isDirectory,
        'upload',
        entryLocalPath,
        entryRemotePath,
        isDirectory ? 0 : file.size
      )
      
      // 递归扫描子文件夹
      if (isDirectory) {
        node.children = await scanFolderStructure(entryLocalPath, entryRemotePath)
      }
      
      nodes.push(node)
    }
  } catch (error: any) {
    console.error('扫描文件夹失败:', error)
  }
  
  console.log('扫描完成，节点数:', nodes.length)
  return nodes
}

/**
 * 取消上传
 * @param transferNodes - 传输节点列表
 * @param sessionId - 会话 ID
 */
export async function cancelUpload(
  transferNodes: TransferNode[],
  sessionId: string
): Promise<void> {
  console.log('取消上传')
  
  // 更新所有传输节点状态为 cancelled
  transferNodes.forEach(node => {
    if (node.status === 'transferring' || node.status === 'pending') {
      node.status = 'cancelled'
    }
  })
  
  // 调用 IPC 层的取消上传方法
  await window.api.sftp.cancelUpload(sessionId)
}

/**
 * 取消下载
 * @param transferNodes - 传输节点列表
 * @param _sessionId - 会话 ID
 */
export async function cancelDownload(
  transferNodes: TransferNode[],
  _sessionId: string
): Promise<void> {
  console.log('取消下载')
  
  // 更新所有传输节点状态为 cancelled
  transferNodes.forEach(node => {
    if (node.status === 'transferring' || node.status === 'pending') {
      node.status = 'cancelled'
    }
  })
  
  // TODO: 实现 IPC 层的取消下载方法
  // await window.api.sftp.cancelDownload(sessionId)
}
