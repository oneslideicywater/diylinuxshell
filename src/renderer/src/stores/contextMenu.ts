import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 右键菜单类型
 */
export type ContextMenuType = 'terminal' | 'tab' | 'session' | 'none'

/**
 * 右键菜单状态管理 Store
 * 确保同一时间只有一个右键菜单显示
 */
export const useContextMenuStore = defineStore('contextMenu', () => {
  // 当前打开的菜单类型
  const currentMenu = ref<ContextMenuType>('none')

  /**
   * 打开指定类型的菜单
   * 如果已有其他菜单打开，会自动关闭
   * @param type 菜单类型
   */
  function openMenu(type: ContextMenuType): void {
    currentMenu.value = type
  }

  /**
   * 关闭当前菜单
   */
  function closeMenu(): void {
    currentMenu.value = 'none'
  }

  /**
   * 检查指定类型的菜单是否打开
   * @param type 菜单类型
   * @returns 是否打开
   */
  function isMenuOpen(type: ContextMenuType): boolean {
    return currentMenu.value === type
  }

  return {
    currentMenu,
    openMenu,
    closeMenu,
    isMenuOpen
  }
})
