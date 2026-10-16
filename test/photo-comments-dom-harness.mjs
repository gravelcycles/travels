// Small DOM model for comment-row identity and mutation checks; no layout claims.
export function commentChildren(node, record = () => {}) {
  node.children = [];
  const clear = () => { for (const child of node.children) { child.parentElement = null; child.isConnected = false; } node.children = []; };
  let html = node.innerHTML || '';
  Object.defineProperty(node, 'innerHTML', { configurable: true, get: () => html, set(value) { html = value; clear(); record('html', node); } });
  node.replaceChildren = (...children) => { clear(); html = ''; record('clear', node); for (const child of children) node.insertBefore(child, null); };
  node.insertBefore = (child, before) => {
    if (child === before) return child;
    if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1);
    const index = before ? node.children.indexOf(before) : node.children.length;
    if (index < 0) throw new Error('insertBefore target is not a child');
    node.children.splice(index, 0, child); child.parentElement = node; child.isConnected = true; record('insert', child); return child;
  };
  node.remove = () => { if (!node.parentElement) return; const parent = node.parentElement; parent.children.splice(parent.children.indexOf(node), 1); node.parentElement = null; node.isConnected = false; record('remove', node); };
  node.replaceWith = child => { const parent = node.parentElement; if (parent) { parent.insertBefore(child, node); node.remove(); } };
  return node;
}
