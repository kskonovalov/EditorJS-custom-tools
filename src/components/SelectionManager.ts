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
    // Only save if not already saved and rangy is available
    if (this.isSaved || !this.rangy) {
      return false;
    }

    const sel = this.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return false;
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
}

export default SelectionManager;
