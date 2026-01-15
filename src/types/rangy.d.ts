declare global {
  interface Window {
    rangy: RangyStatic;
  }
}

export interface RangyStatic {
  getSelection(): RangySelection | null;
  saveSelection(): any;
  restoreSelection(saved: any): void;
  removeMarkers(saved: any): void;
}

export interface RangySelection {
  rangeCount: number;
  isCollapsed: boolean;
  getRangeAt(index: number): RangyRange;
  removeAllRanges(): void;
  addRange(range: RangyRange): void;
  collapseToEnd(): void;
}

export interface RangyRange {
  startContainer: Node;
  endContainer: Node;
  startOffset: number;
  endOffset: number;
  commonAncestorContainer: Node;
  splitBoundaries(): void;
  getNodes(nodeTypes?: number[]): Node[];
  insertNode(node: Node): void;
  selectNode(node: Node): void;
  deleteContents(): void;
  cloneContents(): DocumentFragment;
  collapse(toStart: boolean): void;
  setStart(node: Node, offset: number): void;
  setEnd(node: Node, offset: number): void;
}

export {};
