import { htmlToMarkdown, toMarkdownIfHtml } from '../markdown';

describe('markdown utils', () => {
  test('htmlToMarkdown converts simple HTML to markdown', () => {
    const html = '<h1>Title</h1><p>Hello <strong>world</strong>!</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('# Title');
    expect(md).toContain('Hello **world**!');
  });

  test('toMarkdownIfHtml passes through plain text', () => {
    const text = 'just text';
    expect(toMarkdownIfHtml(text)).toBe(text);
  });

  test('htmlToMarkdown preserves fenced code language', () => {
    const html = '<pre><code class="language-js">console.log("ok");</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('```js');
    expect(md).toContain('console.log("ok");');
  });

  test('htmlToMarkdown converts GFM tables without blank rows', () => {
    const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('| A | B |');
    expect(md).toContain('| 1 | 2 |');
    expect(md).not.toMatch(/\| A \| B \|\n\n\|/);
  });
});
