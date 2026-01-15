import type { InlineTool, SanitizerConfig, API } from '@editorjs/editorjs';
import { IconLink, IconUnlink } from '@codexteam/icons';
import SelectionManager from './SelectionManager';

export default class CustomLinkWithRangy implements InlineTool {
  public static isInline = true;
  public static title = 'Link';
  public static shortcut = 'CMD+K';

  public static get sanitize(): SanitizerConfig {
    return {
      a: {
        href: true,
        target: '_blank',
        rel: 'nofollow',
      },
      b: true,
      strong: true,
      i: true,
      em: true,
      mark: true,
      u: true,
      code: true,
    } as SanitizerConfig;
  }

  private readonly ENTER_KEY: number = 13;

  private readonly CSS = {
    button: 'ce-inline-tool',
    buttonActive: 'ce-inline-tool--active',
    buttonModifier: 'ce-inline-tool--link',
    buttonUnlink: 'ce-inline-tool--unlink',
    input: 'ce-inline-tool-input',
    inputShowed: 'ce-inline-tool-input--showed',
  };

  private nodes: {
    button: HTMLButtonElement | null;
    input: HTMLInputElement | null;
  } = {
      button: null,
      input: null,
    };

  private inputOpened = false;
  private toolbar: API['toolbar'];
  private inlineToolbar: API['inlineToolbar'];
  private notifier: API['notifier'];
  private i18n: API['i18n'];

  constructor({ api }: { api: API }) {
    this.toolbar = api.toolbar;
    this.inlineToolbar = api.inlineToolbar;
    this.notifier = api.notifier;
    this.i18n = api.i18n;
  }

  public render(): HTMLElement {
    const button = document.createElement('button') as HTMLButtonElement;
    button.type = 'button';
    button.classList.add(this.CSS.button, this.CSS.buttonModifier);
    button.innerHTML = IconLink;
    this.nodes.button = button;
    return button;
  }

  public renderActions(): HTMLElement {
    const input = document.createElement('input') as HTMLInputElement;
    input.placeholder = this.i18n.t('Add a link');
    input.enterKeyHint = 'done';
    input.classList.add(this.CSS.input);
    input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.keyCode === this.ENTER_KEY) {
        this.enterPressed(event);
      }
    });
    this.nodes.input = input;
    return input;
  }

  public surround(range: Range): void {
    console.log('Link - surround called, inputOpened:', this.inputOpened);
    
    // Check if clicking on existing link to unlink
    if (range && !this.inputOpened) {
      const parentAnchor = this.findParentTag('A');

      if (parentAnchor) {
        // Restore selection before unlinking
        SelectionManager.restoreSelection();
        
        this.expandToTag(parentAnchor);
        this.unlink();
        this.closeActions();
        this.checkState();
        this.toolbar.close();
        return;
      }
    }

    // If input is opened, just close it (clicking on another tool)
    if (this.inputOpened) {
      console.log('Link - closing input, NOT restoring selection (another tool will use it)');
      this.closeActions();
      return;
    }

    // Otherwise toggle input to add new link
    this.toggleActions();
  }

  public checkState(): boolean {
    // Save selection using global manager (prevents multiple saves)
    SelectionManager.saveSelection();
    
    const anchorTag = this.findParentTag('A');

    if (anchorTag) {
      if (this.nodes.button) {
        this.nodes.button.innerHTML = IconUnlink;
        this.nodes.button.classList.add(this.CSS.buttonUnlink);
        this.nodes.button.classList.add(this.CSS.buttonActive);
      }
      this.openActions();

      const hrefAttr = anchorTag.getAttribute('href');
      if (this.nodes.input) {
        this.nodes.input.value = hrefAttr && hrefAttr !== 'null' ? hrefAttr : '';
      }
    } else {
      if (this.nodes.button) {
        this.nodes.button.innerHTML = IconLink;
        this.nodes.button.classList.remove(this.CSS.buttonUnlink);
        this.nodes.button.classList.remove(this.CSS.buttonActive);
      }
    }

    return !!anchorTag;
  }

  public clear(): void {
    console.log('Link - clear called');
    this.closeActions();
    // DON'T clear global selection here - it's called too often
    // SelectionManager will auto-clear when selection is restored/used
  }

  public get shortcut(): string {
    return 'CMD+K';
  }

  private toggleActions(): void {
    if (!this.inputOpened) {
      this.openActions(true);
    } else {
      this.closeActions();
    }
  }

  private openActions(needFocus = false): void {
    if (this.nodes.input) {
      this.nodes.input.classList.add(this.CSS.inputShowed);
      if (needFocus) {
        this.nodes.input.focus();
      }
    }
    this.inputOpened = true;
  }

  private closeActions(): void {
    if (this.nodes.input) {
      this.nodes.input.classList.remove(this.CSS.inputShowed);
      this.nodes.input.value = '';
    }
    // DON'T clear global selection - other tools might need it
    // SelectionManager will auto-clear after use
    this.inputOpened = false;
  }

  private enterPressed(event: KeyboardEvent): void {
    let value = this.nodes.input?.value || '';

    if (!value.trim()) {
      SelectionManager.restoreSelection();
      this.unlink();
      event.preventDefault();
      this.closeActions();
      return;
    }

    if (!this.validateURL(value)) {
      this.notifier.show({
        message: 'Pasted link is not valid.',
        style: 'error',
      });
      console.warn('Incorrect Link pasted', value);
      return;
    }

    value = this.prepareLink(value);
    
    // Restore saved selection BEFORE inserting link
    console.log('Link - enterPressed: restoring selection before insert');
    if (!SelectionManager.restoreSelection()) {
      console.error('Link - enterPressed: NO saved selection!');
    }

    this.insertLinkWithRangy(value);

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Don't close actions here - let it close naturally
    // this.closeActions(false);
    
    const sel = SelectionManager.getSelection();
    if (sel) {
      sel.collapseToEnd();
    }
    
    this.inlineToolbar.close();
  }

  private validateURL(str: string): boolean {
    return !/\s/.test(str);
  }

  private prepareLink(link: string): string {
    link = link.trim();
    link = this.addProtocol(link);
    return link;
  }

  private addProtocol(link: string): string {
    if (/^(\w+):(\/\/)?/.test(link)) {
      return link;
    }

    const isInternal = /^\/[^/\s]/.test(link);
    const isAnchor = link.substring(0, 1) === '#';
    const isProtocolRelative = /^\/\/[^/\s]/.test(link);

    if (!isInternal && !isAnchor && !isProtocolRelative) {
      link = 'http://' + link;
    }

    return link;
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

  private expandToTag(element: HTMLElement): void {
    const sel = SelectionManager.getSelection();
    if (!sel) return;

    const range = SelectionManager.getRangeAt(0);
    if (range && typeof range === 'object' && 'selectNode' in range) {
      (range as { selectNode: (node: Node) => void }).selectNode(element);
    }
  }

  private insertLinkWithRangy(link: string): void {
    const anchorTag = this.findParentTag('A');

    if (anchorTag && anchorTag instanceof HTMLAnchorElement) {
      anchorTag.href = link;
      return;
    }

    const sel = SelectionManager.getSelection();
    if (!sel || sel.rangeCount === 0) {
      console.error('No selection found');
      return;
    }

    const rangyRange = SelectionManager.getRangeAt(0);
    
    if (!rangyRange) {
      console.error('No range available');
      return;
    }
    
    console.log('Range before split:', rangyRange);
    console.log('Selected text:', rangyRange.toString());
    
    // Split text nodes at range boundaries
    SelectionManager.splitBoundaries(rangyRange);
    
    console.log('Range after split:', rangyRange);
    
    // First, unwrap all existing <a> tags in the range to prevent nested links
    const allNodes = SelectionManager.getNodes(rangyRange, [1]); // 1 = Element nodes
    const existingLinks = allNodes.filter((node: Node) => {
      return (node as HTMLElement).tagName === 'A';
    });
    
    console.log('Found existing links to unwrap:', existingLinks.length);
    
    // Manually unwrap each link
    existingLinks.forEach(link => {
      const parent = link.parentNode;
      if (!parent) return;
      
      // Move all children out of the link
      while (link.firstChild) {
        parent.insertBefore(link.firstChild, link);
      }
      
      // Remove the empty link
      parent.removeChild(link);
    });
    
    // Extract all contents from the range (preserves nested formatting)
    const fragment = rangyRange.cloneContents();
    
    console.log('Fragment extracted:', fragment);
    
    if (!fragment || fragment.childNodes.length === 0) {
      console.error('No content in range');
      return;
    }

    // Remove any <a> tags from the fragment (shouldn't be needed after unwrapping, but just in case)
    const fragmentLinks = fragment.querySelectorAll('a');
    fragmentLinks.forEach(link => {
      const parent = link.parentNode;
      if (parent) {
        while (link.firstChild) {
          parent.insertBefore(link.firstChild, link);
        }
        parent.removeChild(link);
      }
    });

    // Create ONE link element
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.rel = 'nofollow';
    
    // Move all fragment content into the link
    while (fragment.firstChild) {
      a.appendChild(fragment.firstChild);
    }
    
    // Delete the original range content
    rangyRange.deleteContents();
    
    // Insert the link
    rangyRange.insertNode(a);

    console.log('Link inserted successfully');
    
    // Select the newly created link
    const nativeSel = window.getSelection();
    if (nativeSel) {
      const newRange = document.createRange();
      newRange.selectNodeContents(a);
      
      nativeSel.removeAllRanges();
      nativeSel.addRange(newRange);
      
      // Save this selection for Bold/Italic tools
      console.log('Link - saving new selection on inserted link');
      SelectionManager.clearSelection(); // Clear old markers first
      SelectionManager.saveSelection();
    }
  }

  private unlink(): void {
    const anchorTag = this.findParentTag('A');
    if (anchorTag) {
      const parent = anchorTag.parentNode;
      while (anchorTag.firstChild) {
        parent?.insertBefore(anchorTag.firstChild, anchorTag);
      }
      parent?.removeChild(anchorTag);
    }
  }
}
