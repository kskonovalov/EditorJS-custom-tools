/**
 * Global selection manager shared across all inline tools
 * Prevents multiple tools from saving selection simultaneously
 */
class SelectionManager {
  private static savedSelection: unknown = null;
  private static isSaved = false;

  static get rangy() {
    return window.rangy;
  }

  static saveSelection(): boolean {
    // Only save if not already saved and rangy is available
    if (this.isSaved || !this.rangy) {
      return false;
    }

    const sel = this.rangy.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return false;
    }

    console.log('SelectionManager: saving selection');
    this.isSaved = true;
    this.savedSelection = this.rangy.saveSelection();
    return true;
  }

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

  static clearSelection(): void {
    if (this.savedSelection && this.rangy) {
      this.rangy.removeMarkers(this.savedSelection);
    }
    this.savedSelection = null;
    this.isSaved = false;
    
    // Also remove any leftover markers from DOM
    document.querySelectorAll('.rangySelectionBoundary').forEach(el => el.remove());
  }

  static hasSavedSelection(): boolean {
    return this.isSaved;
  }
}

export default SelectionManager;
