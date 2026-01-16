import type { InlineTool } from '@editorjs/editorjs';
import SelectionManager from './SelectionManager';

export default class CustomItalic implements InlineTool {
  public static isInline = true;
  public static title = 'Italic';
  public static shortcut = 'CMD+I';

  private button: HTMLButtonElement | null = null;
  private iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" d="M11 7L13 7m-6 10h6m-4 0l4-10"/></svg>';

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

    // Проверить, все ли ноды уже курсивные
    let allItalic = true;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      let parent = node.parentNode;
      let isItalic = false;
      
      while (parent) {
        if ((parent as HTMLElement).tagName === 'I' || (parent as HTMLElement).tagName === 'EM') {
          isItalic = true;
          break;
        }
        parent = parent.parentNode;
      }
      
      if (!isItalic) {
        allItalic = false;
        break;
      }
    }

    const savedSel = SelectionManager.saveSelectionLocal();

    // Если все курсивные - убрать курсив со всех нод
    if (allItalic) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const italicParent = node.parentNode;
        
        // Найти непосредственного курсивного родителя
        if (italicParent && ((italicParent as HTMLElement).tagName === 'I' || (italicParent as HTMLElement).tagName === 'EM')) {
          const grandparent = italicParent.parentNode;
          grandparent?.insertBefore(node, italicParent);
          // Удалить родителя, если он пустой
          if (!italicParent.hasChildNodes()) {
            grandparent?.removeChild(italicParent);
          }
        }
      }
    } else {
      // Иначе - добавить курсив к не-курсивным нодам
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        let parent = node.parentNode;
        let alreadyItalic = false;
        
        while (parent) {
          if ((parent as HTMLElement).tagName === 'I' || (parent as HTMLElement).tagName === 'EM') {
            alreadyItalic = true;
            break;
          }
          parent = parent.parentNode;
        }
        
        if (!alreadyItalic) {
          const i = document.createElement('i');
          node.parentNode?.insertBefore(i, node);
          i.appendChild(node);
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
    
    const sel = SelectionManager.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return false;
    }

    const anchorNode = sel.getRangeAt(0).startContainer;
    const italicTag = this.findParentTag('I', anchorNode as HTMLElement) || 
                      this.findParentTag('EM', anchorNode as HTMLElement);

    if (italicTag) {
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
    return 'CMD+I';
  }

  public static get sanitize() {
    return {
      i: {},
      em: {},
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
