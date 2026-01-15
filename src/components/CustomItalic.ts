import type { InlineTool } from './EditorJS/types';
import SelectionManager from './SelectionManager';

export default class CustomItalic implements InlineTool {
  public static isInline = true;
  public static title = 'Italic';

  private button: HTMLButtonElement | null = null;
  private iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" d="M11 7L13 7m-6 10h6m-4 0l4-10"/></svg>';

  private get rangy() {
    return window.rangy;
  }

  constructor() {}

  public render(): HTMLElement {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.classList.add('ce-inline-tool');
    this.button.innerHTML = this.iconSvg;
    return this.button;
  }

  public surround(range: Range | null): void {
    // Prefer provided range if not collapsed (user made new selection)
    if (range && !range.collapsed) {
      const nativeSel = window.getSelection();
      if (nativeSel) {
        nativeSel.removeAllRanges();
        nativeSel.addRange(range);
      }
      // Clear old saved selection since we have a new one
      SelectionManager.clearSelection();
    } else {
      // Otherwise try to restore saved selection (first click after adding link)
      if (!SelectionManager.restoreSelection()) {
        return;
      }
    }
    
    const sel = this.rangy.getSelection();
    
    if (!sel || sel.rangeCount === 0) {
      return;
    }

    const rangyRange = sel.getRangeAt(0);
    
    if (!rangyRange || rangyRange.toString() === '') {
      return;
    }
    
    // Split text nodes at range boundaries
    rangyRange.splitBoundaries();
    
    // Get all text nodes in range
    const nodes = rangyRange.getNodes([3]);
    
    if (nodes.length === 0) {
      return;
    }

    // Check if ALL nodes are already italic
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

    const savedSel = this.rangy.saveSelection();

    // If all italic - remove italic from all nodes
    if (allItalic) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const italicParent = node.parentNode;
        
        // Find immediate italic parent
        if (italicParent && ((italicParent as HTMLElement).tagName === 'I' || (italicParent as HTMLElement).tagName === 'EM')) {
          const grandparent = italicParent.parentNode;
          grandparent?.insertBefore(node, italicParent);
          // Remove parent if empty
          if (!italicParent.hasChildNodes()) {
            grandparent?.removeChild(italicParent);
          }
        }
      }
    } else {
      // Otherwise - add italic to non-italic nodes
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

    this.rangy.restoreSelection(savedSel);
    this.rangy.removeMarkers(savedSel);
    
    // Clear global selection after applying format
    SelectionManager.clearSelection();
    
    // Remove any leftover rangy markers from DOM
    document.querySelectorAll('.rangySelectionBoundary').forEach(el => el.remove());
  }

  public checkState(): boolean {
    // Save selection using global manager (prevents multiple saves)
    SelectionManager.saveSelection();
    
    const sel = this.rangy.getSelection();
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
    // Only clear if there's no active selection
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
