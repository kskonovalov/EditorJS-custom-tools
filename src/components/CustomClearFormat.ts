import type { InlineTool } from '@editorjs/editorjs';
import SelectionManager from './SelectionManager';

export default class CustomClearFormat implements InlineTool {
  public static isInline = true;
  public static title = 'Clear Format';
  public static shortcut = 'CMD+\\';

  private button: HTMLButtonElement | null = null;
  private iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M16 6l3 3m-1.5-1.5L9 16l-3 1 1-3 8.5-8.5z"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M10 14l-4 4m8-12L6 14"/></svg>';

  constructor() {}

  public render(): HTMLElement {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.classList.add('ce-inline-tool');
    this.button.innerHTML = this.iconSvg;
    this.button.title = 'Очистить форматирование';
    return this.button;
  }

  public surround(range: Range | null): void {
    
    // Prefer provided range if not collapsed
    if (range && !range.collapsed) {
      const nativeSel = window.getSelection();
      if (nativeSel) {
        nativeSel.removeAllRanges();
        nativeSel.addRange(range);
      }
      SelectionManager.clearSelection();
    } else {
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
    
    const savedSel = SelectionManager.saveSelectionLocal();
    
    // Получить все текстовые ноды в range
    const textNodes = SelectionManager.getNodes(rangyRange, [3]); // 3 = текстовые ноды
    
    
    if (textNodes.length === 0) {
      SelectionManager.restoreSelectionLocal(savedSel);
      SelectionManager.removeMarkersLocal(savedSel);
      return;
    }

    // Tags to remove (everything except links)
    const tagsToRemove = ['B', 'STRONG', 'I', 'EM', 'MARK', 'U', 'CODE', 'S', 'DEL', 'INS', 'SUB', 'SUP'];
    
    // Collect all elements to process
    const elementsToProcess = new Set<HTMLElement>();
    
    textNodes.forEach((textNode: Node) => {
      let parent = textNode.parentNode;
      
      // Find all inline tags that need to be unwrapped (except <a>)
      while (parent && parent.nodeType === Node.ELEMENT_NODE) {
        const parentElement = parent as HTMLElement;
        
        // Stop at block-level element
        if (parentElement.tagName === 'DIV' || parentElement.classList.contains('ce-paragraph')) {
          break;
        }
        
        // Skip <a> tags - we want to keep links
        if (parentElement.tagName === 'A') {
          parent = parent.parentNode;
          continue;
        }
        
        if (tagsToRemove.includes(parentElement.tagName)) {
          elementsToProcess.add(parentElement);
        }
        
        parent = parent.parentNode;
      }
    });
    
    
    // Unwrap all collected elements
    elementsToProcess.forEach(element => {
      this.unwrapElementCompletely(element);
    });

    // Restore selection first
    SelectionManager.restoreSelectionLocal(savedSel);
    
    // Remove markers from the saved selection
    SelectionManager.removeMarkersLocal(savedSel);
    
    // Clear global selection manager
    SelectionManager.clearSelection();
    
    // Force remove any leftover rangy markers from DOM
    setTimeout(() => {
      SelectionManager.cleanupMarkers();
    }, 0);
  }

  /**
   * Completely unwrap an element, moving all children to parent
   */
  private unwrapElementCompletely(element: HTMLElement): void {
    const parent = element.parentNode;
    if (!parent) return;

    // Move all children before the element
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    
    // Remove the now-empty element
    parent.removeChild(element);
  }

  public clear(): void {
    // Очистить только если нет активного выделения
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      SelectionManager.clearSelection();
    }
  }

  public checkState(): boolean {
    SelectionManager.saveSelection();
    return false; // Never show as active
  }

  public get shortcut(): string {
    return 'CMD+\\';
  }

  public static get sanitize() {
    return {
      b: {},
      strong: {},
      i: {},
      em: {},
      a: {
        href: true,
        target: '_blank',
        rel: 'nofollow',
      },
      mark: {},
      u: {},
      code: {},
      s: {},
      del: {},
      ins: {},
      sub: {},
      sup: {},
    };
  }
}
