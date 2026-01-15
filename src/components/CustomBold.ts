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
    console.log('Bold - surround called with range:', range);
    console.log('Bold - range text:', range?.toString());
    
    // Prefer provided range if not collapsed (user made new selection)
    if (range && !range.collapsed) {
      console.log('Bold - Using provided range (new selection)');
      const nativeSel = window.getSelection();
      if (nativeSel) {
        nativeSel.removeAllRanges();
        nativeSel.addRange(range);
      }
      // Clear old saved selection since we have a new one
      SelectionManager.clearSelection();
    } else {
      // Otherwise try to restore saved selection (first click after adding link)
      console.log('Bold - Trying to restore saved selection');
      if (!SelectionManager.restoreSelection()) {
        console.error('Bold - No selection available');
        return;
      }
    }
    
    const sel = SelectionManager.getSelection();
    console.log('Bold - final rangy selection:', sel, 'rangeCount:', sel?.rangeCount);
    
    if (!sel || sel.rangeCount === 0) {
      console.error('Bold - No selection available');
      return;
    }

    const rangyRange = SelectionManager.getRangeAt(0);
    
    if (!rangyRange || rangyRange.toString() === '') {
      console.error('Bold - No valid range available');
      return;
    }

    console.log('Bold - Range before split:', rangyRange.toString());
    console.log('Bold - Range startContainer:', rangyRange.startContainer);
    console.log('Bold - Range endContainer:', rangyRange.endContainer);
    
    // Split text nodes at range boundaries
    SelectionManager.splitBoundaries(rangyRange);
    
    console.log('Bold - After splitBoundaries');
    
    // Get all text nodes in range
    const nodes = SelectionManager.getNodes(rangyRange, [3]);
    
    console.log('Bold - Text nodes found:', nodes.length);
    nodes.forEach((node: Node, i: number) => {
      console.log(`Bold - Node ${i}:`, node, 'parent:', node.parentNode, 'text:', node.textContent);
    });
    
    if (nodes.length === 0) {
      return;
    }

    // Check if ALL nodes are already bold
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

    console.log('Bold - All nodes bold?', allBold);

    const savedSel = SelectionManager.saveSelectionLocal();

    // If all bold - remove bold from all nodes
    if (allBold) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const boldParent = node.parentNode;
        
        // Find immediate bold parent
        if (boldParent && ((boldParent as HTMLElement).tagName === 'B' || (boldParent as HTMLElement).tagName === 'STRONG')) {
          const grandparent = boldParent.parentNode;
          grandparent?.insertBefore(node, boldParent);
          // Remove parent if empty
          if (!boldParent.hasChildNodes()) {
            grandparent?.removeChild(boldParent);
          }
        }
      }
    } else {
      // Otherwise - add bold to non-bold nodes
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
    
    // Clear global selection after applying format
    SelectionManager.clearSelection();
    
    // Remove any leftover rangy markers from DOM
    SelectionManager.cleanupMarkers();
  }

  public checkState(): boolean {
    // Save selection using global manager (prevents multiple saves)
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
    // Only clear if there's no active selection
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
