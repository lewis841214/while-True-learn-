import type { SimEvent } from './types'

/**
 * Min-heap priority queue sorted by SimEvent.time.
 * O(log n) push and pop.
 */
export class EventQueue {
  private heap: SimEvent[] = []

  get size(): number {
    return this.heap.length
  }

  isEmpty(): boolean {
    return this.heap.length === 0
  }

  push(event: SimEvent): void {
    this.heap.push(event)
    this.bubbleUp(this.heap.length - 1)
  }

  peek(): SimEvent | undefined {
    return this.heap[0]
  }

  pop(): SimEvent | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.sinkDown(0)
    }
    return top
  }

  clear(): void {
    this.heap = []
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.heap[parent].time <= this.heap[i].time) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < n && this.heap[left].time < this.heap[smallest].time) smallest = left
      if (right < n && this.heap[right].time < this.heap[smallest].time) smallest = right
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}
