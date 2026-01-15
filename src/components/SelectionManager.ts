/**
 * Глобальный менеджер выделения, общий для всех inline инструментов
 * Предотвращает одновременное сохранение выделения несколькими инструментами
 * Предоставляет всю функциональность rangy через единый API
 */
class SelectionManager {
  private static savedSelection: unknown = null;
  private static isSaved = false;

  static get rangy() {
    return window.rangy;
  }

  /**
   * Получить выделение rangy
   */
  static getSelection() {
    return this.rangy?.getSelection();
  }

  /**
   * Получить range по индексу
   */
  static getRangeAt(index: number) {
    const sel = this.getSelection();
    return sel?.getRangeAt(index);
  }

  /**
   * Разделить текстовые ноды на границах range
   */
  static splitBoundaries(range: unknown) {
    if (range && typeof range === 'object' && 'splitBoundaries' in range) {
      (range as { splitBoundaries: () => void }).splitBoundaries();
    }
  }

  /**
   * Получить ноды из range
   */
  static getNodes(range: unknown, nodeTypes?: number[]): Node[] {
    if (range && typeof range === 'object' && 'getNodes' in range) {
      return (range as { getNodes: (types?: number[]) => Node[] }).getNodes(nodeTypes) || [];
    }
    return [];
  }

  /**
   * Сохранить выделение локально (возвращает объект сохраненного выделения)
   */
  static saveSelectionLocal() {
    return this.rangy?.saveSelection();
  }

  /**
   * Восстановить локальное выделение
   */
  static restoreSelectionLocal(savedSel: unknown) {
    if (savedSel && this.rangy) {
      this.rangy.restoreSelection(savedSel);
      
      // После восстановления выделения нормализовать форматирование для объединения соседних одинаковых тегов
      const sel = this.rangy.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        this.normalizeFormatting(range.commonAncestorContainer);
      }
    }
  }

  /**
   * Удалить маркеры из локального выделения
   */
  static removeMarkersLocal(savedSel: unknown) {
    if (savedSel && this.rangy) {
      this.rangy.removeMarkers(savedSel);
    }
  }

  /**
   * Сохранить глобальное выделение (для использования между инструментами)
   */
  static saveSelection(): boolean {
    if (!this.rangy) {
      return false;
    }

    // Если уже сохранено, не сохранять снова (предотвращает бесконечную регенерацию маркеров)
    if (this.isSaved) {
      return true;
    }

    const sel = this.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return false;
    }

    this.isSaved = true;
    this.savedSelection = this.rangy.saveSelection();
    return true;
  }

  /**
   * Восстановить глобальное выделение
   */
  static restoreSelection(): boolean {
    if (!this.savedSelection || !this.rangy) {
      return false;
    }

    this.rangy.restoreSelection(this.savedSelection);
    this.rangy.removeMarkers(this.savedSelection);
    this.savedSelection = null;
    this.isSaved = false;
    return true;
  }

  /**
   * Очистить глобальное выделение
   */
  static clearSelection(): void {
    if (this.savedSelection && this.rangy) {
      this.rangy.removeMarkers(this.savedSelection);
    }
    this.savedSelection = null;
    this.isSaved = false;
    
    // Также удалить все оставшиеся маркеры из DOM
    document.querySelectorAll('.rangySelectionBoundary').forEach(el => el.remove());
  }

  /**
   * Проверить, сохранено ли глобальное выделение
   */
  static hasSavedSelection(): boolean {
    return this.isSaved;
  }

  /**
   * Удалить все маркеры rangy из DOM
   */
  static cleanupMarkers(): void {
    document.querySelectorAll('.rangySelectionBoundary').forEach(el => el.remove());
  }

  /**
   * Нормализовать форматирование - объединить соседние одинаковые теги и текстовые ноды
   * Это исправляет проблему, когда splitBoundaries создает множество отдельных тегов
   */
  static normalizeFormatting(container?: Node): void {
    const searchRoot = container || document.body;
    
    // Найти параграф/div, содержащий выделение
    let targetElement: HTMLElement | null = null;
    
    if ((searchRoot as HTMLElement).tagName === 'DIV' || (searchRoot as HTMLElement).tagName === 'P') {
      targetElement = searchRoot as HTMLElement;
    } else if (searchRoot.parentElement) {
      targetElement = searchRoot.parentElement;
    }
    
    if (!targetElement) return;
    
    // Сначала нормализовать текстовые ноды (объединить соседние текстовые ноды)
    targetElement.normalize();
    
    // Объединить соседние одинаковые теги форматирования
    const formattingTags = ['B', 'STRONG', 'I', 'EM', 'MARK', 'U', 'CODE'];
    
    formattingTags.forEach(tagName => {
      let elements = Array.from(targetElement!.querySelectorAll(tagName));
      
      for (let i = 0; i < elements.length; i++) {
        const current = elements[i];
        let next = current.nextSibling;
        
        // Пропустить пробельные/пустые текстовые ноды
        while (next && next.nodeType === Node.TEXT_NODE && (!next.textContent || next.textContent.trim() === '')) {
          const temp = next;
          next = next.nextSibling;
          temp.parentNode?.removeChild(temp);
        }
        
        // Если следующий элемент того же типа, объединить их
        if (next && (next as HTMLElement).tagName === tagName) {
          // Переместить всех детей из next в current
          while (next.firstChild) {
            current.appendChild(next.firstChild);
          }
          
          // Удалить пустой next тег
          next.parentNode?.removeChild(next);
          
          // Перепроверить с текущей позиции (может быть больше для объединения)
          i--;
          
          // Обновить массив элементов
          elements = Array.from(targetElement!.querySelectorAll(tagName));
        }
      }
    });
    
    // Нормализовать снова после объединения тегов
    targetElement.normalize();
  }
}

export default SelectionManager;
