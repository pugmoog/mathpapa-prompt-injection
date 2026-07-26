(function (root) {
  'use strict';

  var markedApi = root.marked;
  var mathQuillApi = root.MathQuill && root.MathQuill.getInterface(2);
  if (!markedApi || typeof markedApi.parse !== 'function') throw new Error('Marked is not loaded');
  if (!mathQuillApi || typeof mathQuillApi.StaticMath !== 'function') throw new Error('MathQuill is not loaded');

  var renderId = 0;

  function extractMath(markdown) {
    var source = String(markdown == null ? '' : markdown);
    var formulas = [];
    var tokenPrefix = 'XUGMOOGMATH' + (++renderId) + 'TOKEN';
    var output = '';
    var i = 0;

    function addFormula(latex, display) {
      var token = tokenPrefix + formulas.length + 'END';
      formulas.push({ latex: latex, display: display, token: token });
      output += token;
    }

    while (i < source.length) {
      if (source.slice(i, i + 3) === '```') {
        var fenceEnd = source.indexOf('```', i + 3);
        if (fenceEnd === -1) { output += source.slice(i); break; }
        output += source.slice(i, fenceEnd + 3);
        i = fenceEnd + 3;
        continue;
      }
      if (source.charAt(i) === '`') {
        var codeEnd = source.indexOf('`', i + 1);
        if (codeEnd === -1) { output += source.slice(i); break; }
        output += source.slice(i, codeEnd + 1);
        i = codeEnd + 1;
        continue;
      }
      if (source.slice(i, i + 2) === '$$' && source.charAt(i - 1) !== '\\') {
        var blockEnd = source.indexOf('$$', i + 2);
        if (blockEnd !== -1) {
          addFormula(source.slice(i + 2, blockEnd).trim(), true);
          i = blockEnd + 2;
          continue;
        }
      }
      if (source.charAt(i) === '$' && source.charAt(i - 1) !== '\\') {
        var inlineEnd = source.indexOf('$', i + 1);
        if (inlineEnd !== -1 && source.slice(i + 1, inlineEnd).indexOf('\n') === -1) {
          addFormula(source.slice(i + 1, inlineEnd), false);
          i = inlineEnd + 1;
          continue;
        }
      }
      output += source.charAt(i);
      i++;
    }
    return { markdown: output, formulas: formulas };
  }

  function sanitizeHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = String(html);
    var allowedTags = {
      A: true, P: true, BR: true, HR: true, STRONG: true, EM: true, DEL: true,
      H1: true, H2: true, H3: true, H4: true, H5: true, H6: true,
      UL: true, OL: true, LI: true, BLOCKQUOTE: true, PRE: true, CODE: true,
      TABLE: true, THEAD: true, TBODY: true, TR: true, TH: true, TD: true,
      IMG: true, SPAN: true
    };
    var elements = Array.prototype.slice.call(template.content.querySelectorAll('*'));
    elements.forEach(function (element) {
      if (!allowedTags[element.tagName]) {
        if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'IFRAME' || element.tagName === 'OBJECT') {
          element.remove();
        } else {
          element.parentNode.replaceChild(document.createTextNode(element.textContent || ''), element);
        }
        return;
      }
      Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
        var name = attribute.name.toLowerCase();
        var keep = false;
        if (element.tagName === 'A' && (name === 'href' || name === 'title')) keep = true;
        if (element.tagName === 'IMG' && (name === 'src' || name === 'alt' || name === 'title')) keep = true;
        if (element.tagName === 'CODE' && name === 'class' && /^language-[\w-]+$/.test(attribute.value)) keep = true;
        if ((element.tagName === 'TH' || element.tagName === 'TD') && name === 'align') keep = true;
        if (!keep) element.removeAttribute(attribute.name);
      });
      if (element.tagName === 'A') {
        var href = element.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) element.removeAttribute('href');
        else {
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }
      if (element.tagName === 'IMG') {
        var src = element.getAttribute('src') || '';
        if (!/^https:\/\//i.test(src)) element.removeAttribute('src');
      }
    });
    return template.innerHTML;
  }

  function compile(markdown) {
    var extracted = extractMath(markdown);
    var html = markedApi.parse(extracted.markdown, { gfm: true, breaks: false, async: false });
    html = sanitizeHtml(html);
    extracted.formulas.forEach(function (formula, index) {
      var placeholder = '<span class="mp-math ' + (formula.display ? 'mp-math-display' : 'mp-math-inline') +
        '" data-mp-math-index="' + index + '"></span>';
      html = html.split(formula.token).join(placeholder);
    });
    return { html: html, formulas: extracted.formulas };
  }

  function renderInto(element, markdown) {
    var compiled = compile(markdown);
    element.innerHTML = compiled.html;
    var mathElements = element.querySelectorAll('[data-mp-math-index]');
    Array.prototype.forEach.call(mathElements, function (mathElement) {
      var index = Number(mathElement.getAttribute('data-mp-math-index'));
      var formula = compiled.formulas[index];
      mathElement.removeAttribute('data-mp-math-index');
      try {
        mathQuillApi.StaticMath(mathElement).latex(formula.latex);
      } catch (error) {
        mathElement.textContent = (formula.display ? '$$' : '$') + formula.latex + (formula.display ? '$$' : '$');
        mathElement.title = 'MathQuill could not render this formula';
      }
    });
  }

  var cssText =
    '.mp-markdown{font-size:14px;line-height:1.6;overflow-wrap:anywhere}.mp-markdown>*:first-child{margin-top:0}.mp-markdown>*:last-child{margin-bottom:0}' +
    '.mp-markdown p{margin:0 0 10px}.mp-markdown h1,.mp-markdown h2,.mp-markdown h3,.mp-markdown h4,.mp-markdown h5,.mp-markdown h6{margin:16px 0 8px;line-height:1.25}.mp-markdown h1{font-size:20px}.mp-markdown h2{font-size:17px}.mp-markdown h3{font-size:15px}' +
    '.mp-markdown ul,.mp-markdown ol{margin:6px 0 8px;padding-left:24px}.mp-markdown li{margin:3px 0}.mp-markdown li>ul,.mp-markdown li>ol{margin:4px 0 2px}' +
    '.mp-markdown blockquote{margin:8px 0;padding-left:11px;border-left:3px solid #cbd5e1;color:#64748b}.mp-markdown hr{border:0;border-top:1px solid #cbd5e1;margin:16px 0}' +
    '.mp-markdown code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#e8edf2;border-radius:4px;padding:1px 4px;font-size:.92em}.mp-markdown pre{overflow:auto;background:#1f2937;color:#f8fafc;border-radius:8px;padding:12px;margin:10px 0}.mp-markdown pre code{background:none;padding:0;color:inherit}' +
    '.mp-markdown table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;margin:10px 0;font-size:13px}.mp-markdown th,.mp-markdown td{border:1px solid #cbd5e1;padding:6px 9px}.mp-markdown th{background:#eef2f6;font-weight:650}' +
    '.mp-math-inline{display:inline-block;vertical-align:middle}.mp-math-display{display:block;text-align:center;overflow-x:auto;white-space:nowrap;font-size:1.08em;margin:12px 0;padding:4px}.mp-math-display>.mq-math-mode{display:inline-block}';

  root.XugMoogMarkdown = {
    render: function (markdown) { return compile(markdown).html; },
    renderInto: renderInto,
    cssText: cssText
  };
})(typeof window !== 'undefined' ? window : globalThis);
