// rehype 插件: 让 Markdown 支持彩色文字与高亮
// 语法: {pink}文字{/pink}  →  彩色文字(标题/正文都可用)
//       ==文字==          →  高亮标记
const PALETTE = new Set(['pink', 'blue', 'purple', 'cyan', 'green', 'amber', 'red']);

function splitText(value) {
  const re = /\{([a-z]+)\}([\s\S]+?)\{\/\1\}|\=\=([^=]+?)\=\=/g;
  let last = 0;
  let m;
  const nodes = [];
  while ((m = re.exec(value))) {
    if (m.index > last) nodes.push({ type: 'text', value: value.slice(last, m.index) });
    if (m[1]) {
      const color = PALETTE.has(m[1]) ? m[1] : 'pink';
      nodes.push({
        type: 'element',
        tagName: 'span',
        properties: { className: [`c-${color}`] },
        children: [{ type: 'text', value: m[2] }],
      });
    } else {
      nodes.push({
        type: 'element',
        tagName: 'mark',
        properties: {},
        children: [{ type: 'text', value: m[3] }],
      });
    }
    last = re.lastIndex;
  }
  if (!nodes.length) return null;
  if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
  return nodes;
}

export default function rehypeColors() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'text') {
          const nodes = splitText(child.value);
          if (nodes) {
            node.children.splice(i, 1, ...nodes);
            i += nodes.length - 1;
          }
        } else if (child.type === 'element') {
          if (child.tagName === 'code' || child.tagName === 'pre') continue;
          walk(child);
        }
      }
    };
    walk(tree);
  };
}
