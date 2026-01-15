import type { InlineTool } from '@editorjs/editorjs';
import SelectionManager from './SelectionManager';

export default class CustomMarker implements InlineTool {
  public static isInline = true;
  public static title = 'Marker';
  public static shortcut = 'CMD+SHIFT+M';

  private button: HTMLButtonElement | null = null;
  private iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect width="14" height="10" x="5" y="7" stroke="currentColor" stroke-width="2" rx="3"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 12h6"/></svg>';

  constructor() {}

  public render(): HTMLElement {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.classList.add('ce-inline-tool');
    this.button.innerHTML = this.iconSvg;
    return this.button;
  }

  public surround(range: Range | null): void {
    console.log('Marker - surround called with range:', range);
    console.log('Marker - range text:', range?.toString());
    
    // Prefer provided range if not collapsed (user made new selection)
    if (range && !range.collapsed) {
      console.log('Marker - Using provided range (new selection)');
      const nativeSel = window.getSelection();
      if (nativeSel) {
        nativeSel.removeAllRanges();
        nativeSel.addRange(range);
      }
      // Clear old saved selection since we have a new one
      SelectionManager.clearSelection();
    } else {
      // Otherwise try to restore saved selection (first click after adding link)
      console.log('Marker - Trying to restore saved selection');
      if (!SelectionManager.restoreSelection()) {
        console.error('Marker - No selection available');
        return;
      }
    }
    
    const sel = SelectionManager.getSelection();
    console.log('Marker - final rangy selection:', sel, 'rangeCount:', sel?.rangeCount);
    
    if (!sel || sel.rangeCount === 0) {
      console.error('Marker - No selection available');
      return;
    }

    const rangyRange = SelectionManager.getRangeAt(0);
    
    if (!rangyRange || rangyRange.toString() === '') {
      console.error('Marker - No valid range available');
      return;
    }

    console.log('Marker - Range before split:', rangyRange.toString());
    
    // Split text nodes at range boundaries
    SelectionManager.splitBoundaries(rangyRange);
    
    console.log('Marker - After splitBoundaries');
    
    // Get all text nodes in range
    const nodes = SelectionManager.getNodes(rangyRange, [3]);
    
    console.log('Marker - Text nodes found:', nodes.length);
    
    if (nodes.length === 0) {
      return;
    }

    // Check if ALL nodes are already marked
    let allMarked = true;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const parent = node.parentNode;
      let isMarked = false;
      let currentParent = parent;
      
      while (currentParent) {
        if ((currentParent as HTMLElement).tagName === 'MARK') {
          isMarked = true;
          break;
        }
        currentParent = currentParent.parentNode;
      }
      
      if (!isMarked) {
        allMarked = false;
        break;
      }
    }

    console.log('Marker - All nodes marked?', allMarked);

    const savedSel = SelectionManager.saveSelectionLocal();

    // If all marked - remove mark from all nodes
    if (allMarked) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const markParent = node.parentNode;
        
        // Find immediate mark parent
        if (markParent && (markParent as HTMLElement).tagName === 'MARK') {
          const grandparent = markParent.parentNode;
          grandparent?.insertBefore(node, markParent);
          // Remove parent if empty
          if (!markParent.hasChildNodes()) {
            grandparent?.removeChild(markParent);
          }
        }
      }
    } else {
      // Otherwise - add mark to non-marked nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        let alreadyMarked = false;
        let currentParent = node.parentNode;
        
        while (currentParent) {
          if ((currentParent as HTMLElement).tagName === 'MARK') {
            alreadyMarked = true;
            break;
          }
          currentParent = currentParent.parentNode;
        }
        
        if (!alreadyMarked) {
          const mark = document.createElement('mark');
          mark.className = 'cdx-marker';
          node.parentNode?.insertBefore(mark, node);
          mark.appendChild(node);
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
    const markTag = this.findParentTag('MARK', anchorNode as HTMLElement);

    if (markTag) {
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
    return 'CMD+SHIFT+M';
  }

  public static get sanitize() {
    return {
      mark: {
        class: 'cdx-marker',
      },
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
