import { Directive, ElementRef, OnDestroy, inject, output, signal } from '@angular/core';

function isFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

/** Ported from src/hooks/useDragAndDrop.ts as a directive instead of a hook — apply directly to
 * the element that should accept file drops (`<div gowriteDragAndDrop (dropFile)="...">`), which
 * matches the original's `containerRef` more directly than a service would (no separate
 * attach/detach call needed; Angular's directive lifecycle already scopes it to one element). */
@Directive({
  selector: '[gowriteDragAndDrop]',
  host: {
    '[class.is-drag-over]': 'isDragOver()',
  },
})
export class DragAndDropDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  readonly dropFile = output<File>();
  readonly isDragOver = signal(false);

  private dragDepth = 0;
  private readonly node: HTMLElement;

  private readonly onDragEnter = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    this.dragDepth += 1;
    this.isDragOver.set(true);
  };
  private readonly onDragOver = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  };
  private readonly onDragLeave = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.isDragOver.set(false);
  };
  private readonly onDrop = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    this.dragDepth = 0;
    this.isDragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.dropFile.emit(file);
  };

  constructor() {
    this.node = this.elementRef.nativeElement;
    this.node.addEventListener('dragenter', this.onDragEnter);
    this.node.addEventListener('dragover', this.onDragOver);
    this.node.addEventListener('dragleave', this.onDragLeave);
    this.node.addEventListener('drop', this.onDrop);
  }

  ngOnDestroy(): void {
    this.node.removeEventListener('dragenter', this.onDragEnter);
    this.node.removeEventListener('dragover', this.onDragOver);
    this.node.removeEventListener('dragleave', this.onDragLeave);
    this.node.removeEventListener('drop', this.onDrop);
  }
}
