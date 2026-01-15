/**
 * Global selection manager shared across all inline tools
 * Prevents multiple tools from saving selection simultaneously
 * Provides all rangy functionality through a unified API
 */
class SelectionManager {
  private static savedSelection: unknown = null;
  private static isSaved = false;

  static get rangy() {
    return window.rangy;
  }

  /**
   * Get rangy selection
   */
  static getSelection() {
    return this.rangy?.getSelection();
  }

  /**
   * Get range at index
   */
  static getRangeAt(index: number) {
    const sel = this.getSelection();
    return sel?.getRangeAt(index);
  }

  /**
   * Split text nodes at range boundaries
   */
  static splitBoundaries(range: unknown) {
    if (range && typeof range === 'object' && 'splitBoundaries' in range) {
      (range as { splitBoundaries: () => void }).splitBoundaries();
    }
  }

  /**
   * Get nodes from range
   */
  static getNodes(range: unknown, nodeTypes?: number[]): Node[] {
    if (range && typeof range === 'object' && 'getNodes' in range) {
      return (range as { getNodes: (types?: number[]) => Node[] }).getNodes(nodeTypes) || [];
    }
    return [];
  }

  /**
   * Save selection locally (returns saved selection object)
   */
  static saveSelectionLocal() {
    return this.rangy?.saveSelection();
  }

  /**
   * Restore local selection
   */
  static restoreSelectionLocal(savedSel: unknown) {
    if (savedSel && this.rangy) {
      this.rangy.restoreSelection(savedSel);
      
      // After restoring selection, normalize formatting to merge adjacent identical tags
      const sel = this.rangy.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        this.normalizeFormatting(range.commonAncestorContainer);
      }
    }
  }

  /**
   * Remove markers from local selection
   */
  static removeMarkersLocal(savedSel: unknown) {
    if (savedSel && this.rangy) {
      this.rangy.removeMarkers(savedSel);
    }
  }

  /**
   * Save global selection (for cross-tool usage)
   */
  static saveSelection(): boolean {
    if (!this.rangy) {
      return false;
    }

    const sel = this.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return false;
    }

    // CRITICAL FIX: If already saved, clear old selection first
    // This prevents the bug where a new selection is ignored because isSaved is still true
    if (this.isSaved && this.savedSelection) {
      console.log('SelectionManager: clearing old selection before saving new one');
      this.rangy.removeMarkers(this.savedSelection);
      this.savedSelection = null;
    }

    console.log('SelectionManager: saving selection');
    this.isSaved = true;
    this.savedSelection = this.rangy.saveSelection();
    return true;
  }

  /**
   * Restore global selection
   */
  static restoreSelection(): boolean {
    if (!this.savedSelection || !this.rangy) {
      console.error('SelectionManager: no saved selection to restore');
      return false;
    }

    console.log('SelectionManager: restoring selection');
    this.rangy.restoreSelection(this.savedSelection);
    this.rangy.removeMarkers(this.savedSelection);
    this.savedSelection = null;
    this.isSaved = false;
    return true;
  }

  /**
   * Clear global selection
   */
  static clearSelection(): void {
    if (this.savedSelection && this.rangy) {
      this.rangy.removeMarkers(this.savedSelection);
    }
    this.savedSelection = null;
    this.isSaved = false;
    
    // Also remove any leftover markers from DOM
    document.querySelectorAll('.rangySelectionBoundary').forEach(el => el.remove());
  }

  /**
   * Check if global selection is saved
   */
  static hasSavedSelection(): boolean {
    return this.isSaved;
  }

  /**
   * Remove all rangy markers from DOM
   */
  static cleanupMarkers(): void {
    document.querySelectorAll('.rangySelectionBoundary').forEach(el => el.remove());
  }

  /**
   * Normalize formatting - merge adjacent identical tags and text nodes
   * This fixes the issue where splitBoundaries creates multiple separate tags
   */
  static normalizeFormatting(container?: Node): void {
    const searchRoot = container || document.body;
    
    // Find the paragraph/div containing the selection
    let targetElement: HTMLElement | null = null;
    
    if ((searchRoot as HTMLElement).tagName === 'DIV' || (searchRoot as HTMLElement).tagName === 'P') {
      targetElement = searchRoot as HTMLElement;
    } else if (searchRoot.parentElement) {
      targetElement = searchRoot.parentElement;
    }
    
    if (!targetElement) return;
    
    // Normalize text nodes first (merge adjacent text nodes)
    targetElement.normalize();
    
    // Merge adjacent identical formatting tags
    const formattingTags = ['B', 'STRONG', 'I', 'EM', 'MARK', 'U', 'CODE'];
    
    formattingTags.forEach(tagName => {
      let elements = Array.from(targetElement!.querySelectorAll(tagName));
      
      for (let i = 0; i < elements.length; i++) {
        const current = elements[i];
        let next = current.nextSibling;
        
        // Skip whitespace/empty text nodes
        while (next && next.nodeType === Node.TEXT_NODE && (!next.textContent || next.textContent.trim() === '')) {
          const temp = next;
          next = next.nextSibling;
          temp.parentNode?.removeChild(temp);
        }
        
        // If next is the same tag type, merge them
        if (next && (next as HTMLElement).tagName === tagName) {
          console.log(`SelectionManager - Merging adjacent ${tagName} tags`);
          
          // Move all children from next to current
          while (next.firstChild) {
            current.appendChild(next.firstChild);
          }
          
          // Remove empty next tag
          next.parentNode?.removeChild(next);
          
          // Re-check from current position (there might be more to merge)
          i--;
          
          // Update elements array
          elements = Array.from(targetElement!.querySelectorAll(tagName));
        }
      }
    });
    
    // Normalize again after merging tags
    targetElement.normalize();
  }
}

export default SelectionManager;
