import { getCurrentScope, onScopeDispose } from 'vue'

/**
 * 为同一类请求维护自增序号，只有最新一次请求的结果会被应用。
 *
 * 页面卸载时自动失效，避免异步请求返回后继续写回已销毁页面的状态。
 *
 * @returns {{
 *   next: () => number,
 *   isLatest: (token: number) => boolean,
 *   current: () => number,
 *   invalidate: () => void
 * }}
 */
export function useLatestRequest() {
  let seq = 0

  function invalidate() {
    seq += 1
  }

  if (getCurrentScope()) {
    onScopeDispose(invalidate)
  }

  return {
    next() {
      seq += 1
      return seq
    },
    isLatest(token) {
      return token === seq
    },
    current() {
      return seq
    },
    invalidate
  }
}
