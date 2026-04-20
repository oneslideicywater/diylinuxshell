import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 右键菜单项
 */
export interface ContextMenuItem {
  /** 动作标识（如 'createFolder', 'deleteLocal'） */
  action: string
  /** 菜单项标题 */
  title: string
  /** 菜单项图标名称（对应 contextMenuIcons 注册表中的 key） */
  icon?: string
  /** 菜单项描述（副标题） */
  description?: string
  /** 是否显示（条件渲染） */
  visible?: boolean
  /** 是否为危险操作（红色文字样式） */
  danger?: boolean
}

/**
 * 右键菜单位置（全局坐标，相对于 viewport）
 */
export interface ContextMenuPosition {
  x: number
  y: number
}

/**
 * 右键菜单状态管理 Store
 * 
 * PRD 要求：
 * 1. 整个项目全局使用一个右键菜单组件
 * 2. 全局统一控制显示和隐藏状态
 * 3. 统一处理：点击空白关闭、ESC键关闭、左击关闭
 * 4. 不同组件传入不同的菜单内容（动态 items）
 * 5. 右键菜单定位跟随鼠标位置
 * 6. 使用 Pinia Store 管理状态
 */
export const useContextMenuStore = defineStore('contextMenu', () => {
  /* 全局右键菜单可见性 */
  const visible = ref(false)

  /* 当前菜单拥有者唯一标识 */
  const ownerId = ref<string | null>(null)

  /* 右键菜单位置（viewport 坐标） */
  const position = ref<ContextMenuPosition>({ x: 0, y: 0 })

  /* 当前菜单项列表（动态内容由调用方传入） */
  const items = ref<ContextMenuItem[]>([])

  /* 菜单项点击回调（由调用方提供） */
  const onSelect = ref<((action: string) => void) | null>(null)

  /**
   * 显示全局右键菜单
   * 自动关闭其他已打开的菜单，确保全局唯一性
   * @param ownerUniqueKey 拥有者唯一标识
   * @param pos 菜单位置坐标（viewport 坐标）
   * @param menuItems 菜单项列表
   * @param actionCallback 菜单项点击回调
   */
  function showContextMenu(
    ownerUniqueKey: string,
    pos: ContextMenuPosition,
    menuItems: ContextMenuItem[],
    actionCallback?: (action: string) => void
  ): void {
    visible.value = true
    ownerId.value = ownerUniqueKey
    position.value = { ...pos }
    items.value = menuItems
    onSelect.value = actionCallback || null
  }

  /**
   * 隐藏全局右键菜单
   * 清除所有状态（包括 items 和 callback）
   */
  function hideContextMenu(): void {
    if (!visible.value) return
    visible.value = false
    ownerId.value = null
    items.value = []
    onSelect.value = null
  }

  /**
   * 处理菜单项点击
   * 调用注册的回调函数，然后关闭菜单
   * @param action 菜单项动作标识
   */
  function handleSelect(action: string): void {
    if (onSelect.value) {
      onSelect.value(action)
    }
    hideContextMenu()
  }

  /**
   * 检查指定 ID 是否为当前菜单拥有者
   */
  function isOwner(id: string): boolean {
    return ownerId.value === id && visible.value
  }

  /**
   * 更新菜单位置（用于边界检测后调整）
   */
  function updatePosition(pos: ContextMenuPosition): void {
    position.value = { ...pos }
  }

  return {
    visible,
    ownerId,
    position,
    items,
    showContextMenu,
    hideContextMenu,
    handleSelect,
    isOwner,
    updatePosition
  }
})
