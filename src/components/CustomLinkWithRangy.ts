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
    console.log('render');
    const button = document.createElement('button') as HTMLButtonElement;
    button.type = 'button';
    button.classList.add(this.CSS.button, this.CSS.buttonModifier);
    button.innerHTML = IconLink;
    this.nodes.button = button;
    return button;
  }

  public renderActions(): HTMLElement {
    console.log('renderActions');
    // Создать контейнер для input и кнопок
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '5px';
    
    // Предотвратить всплытие кликов из wrapper
    wrapper.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
    });
    
    wrapper.addEventListener('mousedown', (event: MouseEvent) => {
      event.stopPropagation();
    });
    
    // Создать кнопку применения (галочка)
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    applyButton.style.padding = '5px';
    applyButton.style.cursor = 'pointer';
    applyButton.style.border = 'none';
    applyButton.style.background = 'transparent';
    applyButton.style.display = 'flex';
    applyButton.style.alignItems = 'center';
    applyButton.style.color = '#52c41a'; // Зеленый цвет для галочки
    applyButton.title = 'Apply link';
    applyButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.applyLink();
    });
    
    // Создать input
    const input = document.createElement('input') as HTMLInputElement;
    input.placeholder = this.i18n.t('Add a link');
    input.enterKeyHint = 'done';
    input.classList.add(this.CSS.input);
    input.style.flex = '1';
    
    // Предотвратить всплытие событий input и нежелательное поведение
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
      // Не позволять другим событиям клавиш всплывать
      event.stopPropagation();
    });
    
    input.addEventListener('input', (event: Event) => {
      event.stopPropagation();
    });
    
    this.nodes.input = input;
    
    // Создать кнопку удаления ссылки
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

  public surround(): void {
    // Сохранить выделение перед открытием input (чтобы не потерять его при фокусе на input)
    SelectionManager.saveSelection();
    
    // Просто переключить поле ввода
    // Удаление ссылки теперь обрабатывается кнопкой X внутри input
    this.toggleActions();
  }

  public checkState(): boolean {
    console.log('checkState');
    const anchorTag = this.findParentTag('A');

    if (anchorTag) {
      if (this.nodes.button) {
        this.nodes.button.innerHTML = IconUnlink;
        this.nodes.button.classList.add(this.CSS.buttonUnlink);
        this.nodes.button.classList.add(this.CSS.buttonActive);
      }
      // Не визуально оборачивать если уже внутри ссылки
      this.openActions(false, true);

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
    this.closeActions();
    // DON'T clear global selection here - it's called too often
    // SelectionManager автоматически очистит при восстановлении/использовании выделения
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

  private openActions(needFocus = false, skipVisualWrap = false): void {
    if (this.nodes.input) {
      this.nodes.input.classList.add(this.CSS.inputShowed);
      if (needFocus) {
        this.nodes.input.focus();
      }
    }
    this.inputOpened = true;
    
    // Визуально обозначить выделение пока открыт input (но не для существующих ссылок)
    if (!skipVisualWrap) {
      this.wrapSelectionVisually();
    }
  }

  private closeActions(): void {
    if (this.nodes.input) {
      this.nodes.input.classList.remove(this.CSS.inputShowed);
      this.nodes.input.value = '';
    }
    // НЕ очищать глобальное выделение - другим инструментам может понадобиться
    // SelectionManager автоматически очистит после использования
    this.inputOpened = false;
    
    // Удалить визуальную обертку
    this.unwrapVisibleSelection();
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
      return;
    }

    value = this.prepareLink(value);
    
    // Восстановить сохраненное выделение ПЕРЕД вставкой ссылки
    SelectionManager.restoreSelection();

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

  /**
   * Обернуть текущее выделение в span с классом visibleselection для визуального отображения
   * Использует rangy маркеры для определения границ выделения
   */
  private wrapSelectionVisually(): void {
    // Найти rangy маркеры выделения в DOM
    const markers = document.querySelectorAll('.rangySelectionBoundary');
    
    if (markers.length < 2) {
      return;
    }

    const startMarker = markers[0];
    const endMarker = markers[markers.length - 1];
    
    if (!startMarker || !endMarker || !startMarker.parentNode) {
      return;
    }

    try {
      // Создать range между маркерами
      const range = document.createRange();
      range.setStartAfter(startMarker);
      range.setEndBefore(endMarker);
      
      // Извлечь содержимое между маркерами
      const contents = range.extractContents();
      
      // Создать визуальный span
      const visualSpan = document.createElement('span');
      visualSpan.className = 'visibleselection';
      visualSpan.style.backgroundColor = 'rgba(82, 196, 26, 0.2)';
      visualSpan.style.borderRadius = '2px';
      
      // Поместить содержимое в span
      visualSpan.appendChild(contents);
      
      // Вставить span обратно в DOM между маркерами
      range.insertNode(visualSpan);
      
    } catch {
      // Игнорировать ошибки
    }
  }

  /**
   * Удалить все span.visibleselection, оставив их содержимое
   */
  private unwrapVisibleSelection(): void {
    const visibleSpans = document.querySelectorAll('span.visibleselection');
    
    visibleSpans.forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      
      // Вынести всех детей из span
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      
      // Удалить пустой span
      parent.removeChild(span);
    });
    
    // Нормализовать текстовые ноды после удаления span
    const contentEditable = document.querySelector('[contenteditable="true"]');
    if (contentEditable) {
      (contentEditable as HTMLElement).normalize();
    }
  }

  private insertLinkWithRangy(link: string): void {
    // Удалить визуальную обертку перед вставкой ссылки
    this.unwrapVisibleSelection();
    
    const anchorTag = this.findParentTag('A');

    if (anchorTag && anchorTag instanceof HTMLAnchorElement) {
      anchorTag.href = link;
      return;
    }

    const sel = SelectionManager.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return;
    }

    const rangyRange = SelectionManager.getRangeAt(0);
    
    if (!rangyRange) {
      return;
    }
    
    
    // Разделить текстовые ноды на границах range
    SelectionManager.splitBoundaries(rangyRange);
    
    
    // ШАГ 1: Удалить ВСЕ существующие теги <a> в range для предотвращения вложенных ссылок
    const allNodes = SelectionManager.getNodes(rangyRange, [1]); // 1 = узлы элементов
    const existingLinks = allNodes.filter((node: Node) => {
      return (node as HTMLElement).tagName === 'A';
    });
    
    
    // Развернуть каждую существующую ссылку (вынести детей, удалить тег ссылки)
    existingLinks.forEach(linkNode => {
      const parent = linkNode.parentNode;
      if (!parent) return;
      
      while (linkNode.firstChild) {
        parent.insertBefore(linkNode.firstChild, linkNode);
      }
      parent.removeChild(linkNode);
    });
    
    // ШАГ 2: Извлечь все содержимое из range (сохраняет вложенное форматирование типа <b>, <i> и т.д.)
    const fragment = rangyRange.cloneContents();
    
    
    if (!fragment || fragment.childNodes.length === 0) {
      return;
    }

    // ШАГ 3: Удалить все оставшиеся теги <a> из fragment (на всякий случай)
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

    // ШАГ 4: Создать ОДНУ ссылку для всего выделения
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.rel = 'nofollow';
    
    // Переместить все содержимое fragment в одну ссылку
    while (fragment.firstChild) {
      a.appendChild(fragment.firstChild);
    }
    
    // ШАГ 5: Удалить оригинальное содержимое range
    rangyRange.deleteContents();
    
    // ШАГ 6: Вставить одну ссылку
    rangyRange.insertNode(a);

    
    // Нормализовать форматирование внутри ссылки (объединить соседние одинаковые теги)
    SelectionManager.normalizeFormatting(a);
    
    // Выделить только что созданную ссылку
    const nativeSel = window.getSelection();
    if (nativeSel) {
      const newRange = document.createRange();
      newRange.selectNodeContents(a);
      
      nativeSel.removeAllRanges();
      nativeSel.addRange(newRange);
      
      // Сохранить это выделение для инструментов Bold/Italic
      SelectionManager.clearSelection();
      SelectionManager.saveSelection();
    }
  }

  private removeLink(): void {
    // Удалить визуальную обертку перед удалением ссылки
    this.unwrapVisibleSelection();
    
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
