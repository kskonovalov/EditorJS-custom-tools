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
    // Create container for input and unlink button
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '5px';
    
    // Prevent clicks on wrapper from bubbling up
    wrapper.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
    });
    
    wrapper.addEventListener('mousedown', (event: MouseEvent) => {
      event.stopPropagation();
    });
    
    // Create apply button (checkmark)
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    applyButton.style.padding = '5px';
    applyButton.style.cursor = 'pointer';
    applyButton.style.border = 'none';
    applyButton.style.background = 'transparent';
    applyButton.style.display = 'flex';
    applyButton.style.alignItems = 'center';
    applyButton.style.color = '#52c41a'; // Green color for checkmark
    applyButton.title = 'Apply link';
    applyButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.applyLink();
    });
    
    // Create input
    const input = document.createElement('input') as HTMLInputElement;
    input.placeholder = this.i18n.t('Add a link');
    input.enterKeyHint = 'done';
    input.classList.add(this.CSS.input);
    input.style.flex = '1';
    
    // Prevent input events from bubbling up and causing unwanted behavior
    input.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
    });
    
    input.addEventListener('mousedown', (event: MouseEvent) => {
      event.stopPropagation();
    });
    
    input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.keyCode === this.ENTER_KEY) {
        this.enterPressed(event);
      }
      // Don't let other key events bubble up
      event.stopPropagation();
    });
    
    input.addEventListener('input', (event: Event) => {
      event.stopPropagation();
    });
    
    this.nodes.input = input;
    
    // Create unlink button
    const unlinkButton = document.createElement('button');
    unlinkButton.type = 'button';
    unlinkButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    unlinkButton.style.padding = '5px';
    unlinkButton.style.cursor = 'pointer';
    unlinkButton.style.border = 'none';
    unlinkButton.style.background = 'transparent';
    unlinkButton.style.display = 'flex';
    unlinkButton.style.alignItems = 'center';
    unlinkButton.title = 'Remove link';
    unlinkButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.removeLink();
    });
    
    wrapper.appendChild(input);
    wrapper.appendChild(applyButton);
    wrapper.appendChild(unlinkButton);
    
    return wrapper;
  }

  public surround(range: Range): void {
    console.log('Link - surround called, inputOpened:', this.inputOpened, 'range:', range);
    
    // Just toggle the input field
    // Link removal is now handled by the X button inside the input
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

  private applyLink(): void {
    let value = this.nodes.input?.value || '';

    if (!value.trim()) {
      SelectionManager.restoreSelection();
      this.unlink();
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
    console.log('Link - applyLink: restoring selection before insert');
    if (!SelectionManager.restoreSelection()) {
      console.error('Link - applyLink: NO saved selection!');
    }

    this.insertLinkWithRangy(value);
    
    const sel = SelectionManager.getSelection();
    if (sel) {
      sel.collapseToEnd();
    }
    
    this.inlineToolbar.close();
  }

  private enterPressed(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    this.applyLink();
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
    
    // STEP 1: Remove ALL existing <a> tags in the range to prevent nested links
    const allNodes = SelectionManager.getNodes(rangyRange, [1]); // 1 = Element nodes
    const existingLinks = allNodes.filter((node: Node) => {
      return (node as HTMLElement).tagName === 'A';
    });
    
    console.log('Found existing links to remove:', existingLinks.length);
    
    // Unwrap each existing link (move children out, remove link tag)
    existingLinks.forEach(linkNode => {
      const parent = linkNode.parentNode;
      if (!parent) return;
      
      while (linkNode.firstChild) {
        parent.insertBefore(linkNode.firstChild, linkNode);
      }
      parent.removeChild(linkNode);
    });
    
    // STEP 2: Extract all contents from the range (preserves nested formatting like <b>, <i>, etc.)
    const fragment = rangyRange.cloneContents();
    
    console.log('Fragment extracted:', fragment);
    
    if (!fragment || fragment.childNodes.length === 0) {
      console.error('No content in range');
      return;
    }

    // STEP 3: Remove any remaining <a> tags from the fragment (just in case)
    const fragmentLinks = fragment.querySelectorAll('a');
    fragmentLinks.forEach(linkNode => {
      const parent = linkNode.parentNode;
      if (parent) {
        while (linkNode.firstChild) {
          parent.insertBefore(linkNode.firstChild, linkNode);
        }
        parent.removeChild(linkNode);
      }
    });

    // STEP 4: Create ONE link element for entire selection
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.rel = 'nofollow';
    
    // Move all fragment content into the single link
    while (fragment.firstChild) {
      a.appendChild(fragment.firstChild);
    }
    
    // STEP 5: Delete the original range content
    rangyRange.deleteContents();
    
    // STEP 6: Insert the single link
    rangyRange.insertNode(a);

    console.log('Link inserted successfully (single link wrapping entire selection)');
    
    // Normalize formatting inside the link (merge adjacent identical tags)
    SelectionManager.normalizeFormatting(a);
    
    // Select the newly created link
    const nativeSel = window.getSelection();
    if (nativeSel) {
      const newRange = document.createRange();
      newRange.selectNodeContents(a);
      
      nativeSel.removeAllRanges();
      nativeSel.addRange(newRange);
      
      // Save this selection for Bold/Italic tools
      console.log('Link - saving new selection on inserted link');
      SelectionManager.clearSelection();
      SelectionManager.saveSelection();
    }
  }

  private removeLink(): void {
    console.log('Link - removeLink called');
    
    const anchorTag = this.findParentTag('A');
    if (anchorTag) {
      // Expand selection to cover the entire link
      this.expandToTag(anchorTag);
      
      // Remove the link
      this.unlink();
      
      // Close the input
      this.closeActions();
      
      // Update button state
      this.checkState();
      
      // Close toolbar
      this.toolbar.close();
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
