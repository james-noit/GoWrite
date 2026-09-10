import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DragAndDropDirective } from './drag-and-drop.directive';

@Component({
  imports: [DragAndDropDirective],
  template: `<div gowriteDragAndDrop (dropFile)="onDrop($event)"></div>`,
})
class HostComponent {
  @ViewChild(DragAndDropDirective) directive!: DragAndDropDirective;
  droppedFiles: File[] = [];
  onDrop(file: File): void {
    this.droppedFiles.push(file);
  }
}

function fileDragEvent(type: string): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: ['Files'], files: [new File(['x'], 'test.txt')] },
  });
  return event;
}

describe('DragAndDropDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    el = fixture.nativeElement.querySelector('div');
  });

  it('sets isDragOver on dragenter with a file drag', () => {
    el.dispatchEvent(fileDragEvent('dragenter'));
    expect(fixture.componentInstance.directive.isDragOver()).toBe(true);
  });

  it('ignores a non-file drag (e.g. dragging text/an element)', () => {
    const event = new Event('dragenter', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['text/plain'] } });
    el.dispatchEvent(event);
    expect(fixture.componentInstance.directive.isDragOver()).toBe(false);
  });

  it('clears isDragOver only once drag depth returns to 0 (nested enter/leave)', () => {
    el.dispatchEvent(fileDragEvent('dragenter'));
    el.dispatchEvent(fileDragEvent('dragenter')); // entering a child element
    el.dispatchEvent(fileDragEvent('dragleave')); // leaving the child, still over the container
    expect(fixture.componentInstance.directive.isDragOver()).toBe(true);

    el.dispatchEvent(fileDragEvent('dragleave'));
    expect(fixture.componentInstance.directive.isDragOver()).toBe(false);
  });

  it('drop emits dropFile with the dropped file and resets isDragOver', () => {
    el.dispatchEvent(fileDragEvent('dragenter'));
    el.dispatchEvent(fileDragEvent('drop'));

    expect(fixture.componentInstance.droppedFiles).toHaveLength(1);
    expect(fixture.componentInstance.droppedFiles[0].name).toBe('test.txt');
    expect(fixture.componentInstance.directive.isDragOver()).toBe(false);
  });
});
