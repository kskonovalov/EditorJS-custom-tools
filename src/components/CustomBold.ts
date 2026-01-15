import type { InlineTool } from '@editorjs/editorjs';
import SelectionManager from './SelectionManager';

export default class CustomBold implements InlineTool {
  public static isInline = true;
  public static title = 'Bold';
  public static shortcut = 'CMD+B';

  private button: HTMLButtonElement | null = null;
  private iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" d="M9 7h9.5a3.5 3.5 0 1 1 0 7H9m0-7H6.5m2.5 0v14m0-7h9.5m-9.5 7h9.5a3.5 3.5 0 1 1 0-7M9 21H6.5"/></svg>';

  constructor() {}

  public render(): HTMLElement {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.classList.add('ce-inline-tool');
    this.button.innerHTML = this.iconSvg;
    return this.button;
  }

  public surround(range: Range | null): void {
    // Предпочитать переданный range, если он не схлопнут (пользователь сделал новое выделение)
    if (range && !range.collapsed) {
      const nativeSel = window.getSelection();
      if (nativeSel) {
        nativeSel.removeAllRanges();
        nativeSel.addRange(range);
      }
      // Очистить старое сохраненное выделение, так как есть новое
      SelectionManager.clearSelection();
    } else {
      // Иначе попытаться восстановить сохраненное выделение (первый клик после добавления ссылки)
      if (!SelectionManager.restoreSelection()) {
        return;
      }
    }
    
    const sel = SelectionManager.getSelection();
    
    if (!sel || sel.rangeCount === 0) {
      return;
    }

    const rangyRange = SelectionManager.getRangeAt(0);
    
    if (!rangyRange || rangyRange.toString() === '') {
      return;
    }

    // Разделить текстовые ноды на границах range
    SelectionManager.splitBoundaries(rangyRange);
    
    // Получить все текстовые ноды в range
    const nodes = SelectionManager.getNodes(rangyRange, [3]);
    
    if (nodes.length === 0) {
      return;
    }

    // Проверить, все ли ноды уже жирные
    let allBold = true;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const parent = node.parentNode;
      let isBold = false;
      let currentParent = parent;
      
      while (currentParent) {
        if ((currentParent as HTMLElement).tagName === 'B' || (currentParent as HTMLElement).tagName === 'STRONG') {
          isBold = true;
          break;
        }
        currentParent = currentParent.parentNode;
      }
      
      if (!isBold) {
        allBold = false;
        break;
      }
    }

    const savedSel = SelectionManager.saveSelectionLocal();

    // Если все жирные - убрать жирность со всех нод
    if (allBold) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const boldParent = node.parentNode;
        
        // Найти непосредственного жирного родителя
        if (boldParent && ((boldParent as HTMLElement).tagName === 'B' || (boldParent as HTMLElement).tagName === 'STRONG')) {
          const grandparent = boldParent.parentNode;
          grandparent?.insertBefore(node, boldParent);
          // Удалить родителя, если он пустой
          if (!boldParent.hasChildNodes()) {
            grandparent?.removeChild(boldParent);
          }
        }
      }
    } else {
      // Иначе - добавить жирность к не-жирным нодам
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        let alreadyBold = false;
        let currentParent = node.parentNode;
        
        while (currentParent) {
          if ((currentParent as HTMLElement).tagName === 'B' || (currentParent as HTMLElement).tagName === 'STRONG') {
            alreadyBold = true;
            break;
          }
          currentParent = currentParent.parentNode;
        }
        
        if (!alreadyBold) {
          const b = document.createElement('b');
          node.parentNode?.insertBefore(b, node);
          b.appendChild(node);
        }
      }
    }

    SelectionManager.restoreSelectionLocal(savedSel);
    SelectionManager.removeMarkersLocal(savedSel);
    
    // Очистить глобальное выделение после применения форматирования
    SelectionManager.clearSelection();
    
    // Удалить все оставшиеся маркеры rangy из DOM
    SelectionManager.cleanupMarkers();
  }

  public checkState(): boolean {
    // Сохранить выделение с помощью глобального менеджера (предотвращает множественные сохранения)
    SelectionManager.saveSelection();
    
    const sel = SelectionManager.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return false;
    }

    const anchorNode = sel.getRangeAt(0).startContainer;
    const boldTag = this.findParentTag('B', anchorNode as HTMLElement) || 
                    this.findParentTag('STRONG', anchorNode as HTMLElement);

    if (boldTag) {
      this.button?.classList.add('ce-inline-tool--active');
      return true;
    }

    this.button?.classList.remove('ce-inline-tool--active');
    return false;
  }

  public clear(): void {
    // Очистить только если нет активного выделения
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      SelectionManager.clearSelection();
    }
  }

  public get shortcut(): string {
    return 'CMD+B';
  }

  public static get sanitize() {
    return {
      b: {},
      strong: {},
    };
  }

  private findParentTag(tagName: string, element?: HTMLElement): HTMLElement | null {
    const el = element || window.getSelection()?.anchorNode;
    if (!el) return null;

    let target = el as HTMLElement;
    if (target.nodeType === Node.TEXT_NODE) {
      target = target.parentElement as HTMLElement;
    }

    while (target && target.tagName !== 'DIV') {
      if (target.tagName === tagName) {
        return target;
      }
      target = target.parentElement as HTMLElement;
    }

    return null;
  }
}
