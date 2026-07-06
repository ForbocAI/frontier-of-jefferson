(function (fp) {
  const core = fp || (function () {
    throw new Error('fp.js must load before index.js');
  })();

  const just = core.just;
  const nothing = core.nothing;
  const fromNullable = core.fromNullable;
  const orElse = core.orElse;
  const compose = core.compose;
  const curry = core.curry;
  const createDispatcher = core.createDispatcher;
  const multiMatch = core.multiMatch;
  const _ = core._;

  const nav = document.getElementById('sidebar-nav');
  const sidebarHeader = document.getElementById('sidebar-header');
  const pageHeader = document.getElementById('page-header');
  const pageFooter = document.getElementById('page-footer');
  const content = document.getElementById('content-inner');
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menu-toggle');
  const headerToggle = document.getElementById('header-menu-toggle');
  const forbocAiUrl = 'https://forboc.ai';
  const frontierOfJeffersonUrl = 'https://frontier-of-jefferson.forboc.ai/';

  let activePath = null;
  let navIndex = {};
  let pageCatalog = [];
  let terminalOutput = null;
  let terminalInput = null;
  let terminalHistory = [];
  let terminalHistoryIndex = 0;
  let terminalDraft = '';
  let browserCli = null;

  import('https://esm.sh/@forbocai/browser').then(function(mod) {
    if (mod.createBrowserCli) {
      browserCli = mod.createBrowserCli({
        _apiUrl: 'https://api.forboc.ai'
      });
      console.log('ForbocAI CLI loaded');
    }
  }).catch(function(e) {
    console.error('Failed to load ForbocAI CLI', e);
  });

  const defaultMeta = {
    siteName: 'Frontier of Jefferson',
    siteDescription: 'Rules, lore, folk, places, and play notes for Frontier of Jefferson, a ForbocAI frontier game set in 1899.',
    defaultImagePath: '/forbocai-logo.png',
    author: 'ForbocAI, Inc.',
    locale: 'en-US'
  };

  // Convert between clean URL paths and .md file paths
  function toCleanPath(mdPath) {
    return '/' + mdPath.replace(/\.md$/, '');
  }

  function toMdPath(cleanPath) {
    const p = cleanPath.replace(/^\//, '').replace(/\/$/, '');
    return p ? p + '.md' : '';
  }

  const replace = curry(function (pattern, replacement, text) {
    return text.replace(pattern, replacement);
  });

  const resolveImages = curry(function (baseUrl, text) {
    return text.replace(/!\[([^\]]+)\]\(([^)]+)\)/g, function (match, alt, src) {
      return '<img src="' + resolveRelativePath(baseUrl, src) + '" alt="' + alt + '" class="content-image">';
    });
  });

  function nonEmptyMaybe(value) {
    return value ? just(value) : nothing();
  }

  function resolveRelativePath(baseUrl, src) {
    return multiMatch(src, [
      [function (value) {
        return value.indexOf('http') === 0;
      }, function (value) {
        return value;
      }],
      [function (value) {
        return value.indexOf('/') === 0;
      }, function (value) {
        return value;
      }],
      [_, function (value) {
        return fromNullable(baseUrl)
          .chain(nonEmptyMaybe)
          .map(function (base) {
            return base.substring(0, base.lastIndexOf('/') + 1) + value;
          })
          .getOrElse(value);
      }]
    ]).getOrElse(src);
  }

  function trimText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function normalizeCommandText(text) {
    return trimText((text || '')
      .toLowerCase()
      .replace(/\.md$/g, '')
      .replace(/[\/_-]+/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' '));
  }

  function toPlainText(text) {
    return trimText(text
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^>[ ]?/gm, ''));
  }

  function toAbsoluteUrl(pathOrUrl) {
    return multiMatch(pathOrUrl, [
      [function (value) {
        return value.indexOf('http') === 0;
      }, function (value) {
        return value;
      }],
      [function (value) {
        return value.indexOf('//') === 0;
      }, function (value) {
        return window.location.protocol + value;
      }],
      [function (value) {
        return value.indexOf('/') === 0;
      }, function (value) {
        return window.location.origin + value;
      }],
      [_, function (value) {
        return window.location.origin + '/' + value.replace(/^\//, '');
      }]
    ]).getOrElse(window.location.origin + defaultMeta.defaultImagePath);
  }

  function firstHeadingMaybe(md) {
    return fromNullable(md.match(/^#{1,4}\s+(.+)$/m))
      .map(function (match) {
        return trimText(match[1]);
      })
      .chain(nonEmptyMaybe);
  }

  function isDescriptiveBlock(block) {
    const firstLine = trimText((block.split('\n')[0] || ''));
    return multiMatch(firstLine, [
      [function (value) {
        return /^(!\[|#|>|[-*] |\d+\. |---|`)/.test(value);
      }, function () {
        return false;
      }],
      [_, function () {
        return true;
      }]
    ]).getOrElse(false);
  }

  function firstParagraphMaybe(md) {
    return md.replace(/```[\s\S]*?```/g, '\n')
      .split(/\n\s*\n/)
      .reduce(function (found, block) {
        const rawBlock = trimText(block);
        const candidate = toPlainText(block);
        return found.match({
          just: function () {
            return found;
          },
          nothing: function () {
            return candidate && isDescriptiveBlock(rawBlock) ? just(candidate) : nothing();
          }
        });
      }, nothing());
  }

  function shortenText(text, maxLength) {
    const sliced = text.slice(0, maxLength + 1);
    const boundary = sliced.lastIndexOf(' ');
    const safeText = boundary > 0 ? sliced.slice(0, boundary) : text.slice(0, maxLength);
    return text.length <= maxLength ? text : safeText.replace(/[.,;:!?-]*$/, '') + '...';
  }

  function firstImageMaybe(md, baseUrl) {
    return fromNullable(md.match(/!\[([^\]]*)\]\(([^)]+)\)/))
      .map(function (match) {
        const alt = trimText(match[1] || defaultMeta.siteName) || defaultMeta.siteName;
        return {
          alt: alt,
          src: toAbsoluteUrl(resolveRelativePath(baseUrl, match[2]))
        };
      });
  }

  function navEntry(path) {
    return fromNullable(navIndex[path]);
  }

  function composeDocumentTitle(pageTitle) {
    return pageTitle.toLowerCase().indexOf(defaultMeta.siteName.toLowerCase()) >= 0
      ? pageTitle
      : pageTitle + ' | ' + defaultMeta.siteName;
  }

  function buildKeywordList(title, section) {
    const keywords = [
      defaultMeta.siteName,
      title,
      section,
      'ForbocAI',
      'Jefferson State',
      'French Gulch',
      'frontier game',
      'open world',
      'rules',
      'lore'
    ];

    return keywords.reduce(function (unique, keyword) {
      const cleaned = trimText(keyword || '');
      return !cleaned || unique.indexOf(cleaned) >= 0
        ? unique
        : unique.concat([cleaned]);
    }, []).join(', ');
  }

  function replaceLast(list, value) {
    return list.length === 0 ? [value] : list.slice(0, -1).concat([value]);
  }

  function addItemToCurrentSection(state, entry) {
    return fromNullable(state.current)
      .map(function (section) {
        const nextSection = {
          label: section.label,
          items: section.items.concat([{ label: entry.label, path: entry.path }])
        };
        return {
          title: state.title,
          sections: replaceLast(state.sections, nextSection),
          current: nextSection
        };
      })
      .getOrElse(state);
  }

  function pageType(path) {
    return path.indexOf('introduction/') === 0 ? 'website' : 'article';
  }

  function buildPageMetadata(md, path) {
    const navDetails = navEntry(path).getOrElse({});
    const section = navDetails.section || 'Introduction';
    const fallbackTitle = navDetails.label || defaultMeta.siteName;
    const title = firstHeadingMaybe(md).getOrElse(fallbackTitle);
    const description = firstParagraphMaybe(md)
      .map(function (text) {
        return shortenText(text, 200);
      })
      .getOrElse(defaultMeta.siteDescription);
    const image = firstImageMaybe(md, '/' + path).getOrElse({
      alt: defaultMeta.siteName,
      src: toAbsoluteUrl(defaultMeta.defaultImagePath)
    });
    const cleanPath = toCleanPath(path);

    return {
      canonicalUrl: toAbsoluteUrl(cleanPath),
      description: description,
      documentTitle: composeDocumentTitle(title),
      imageAlt: image.alt,
      imageUrl: image.src,
      keywords: buildKeywordList(title, section),
      section: section,
      title: title,
      type: pageType(path)
    };
  }

  function setNodeAttribute(selector, attribute, value) {
    fromNullable(document.querySelector(selector)).map(function (node) {
      node.setAttribute(attribute, value);
      return node;
    });
  }

  function setNodeText(selector, text) {
    fromNullable(document.querySelector(selector)).map(function (node) {
      node.textContent = text;
      return node;
    });
  }

  function buildStructuredData(meta) {
    return multiMatch(meta.type, [
      [function (value) {
        return value === 'website';
      }, function () {
        return {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: meta.title,
          description: meta.description,
          url: meta.canonicalUrl,
          inLanguage: defaultMeta.locale,
          image: meta.imageUrl,
          author: {
            '@type': 'Organization',
            name: defaultMeta.author
          }
        };
      }],
      [_, function () {
        return {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: meta.title,
          description: meta.description,
          url: meta.canonicalUrl,
          image: meta.imageUrl,
          articleSection: meta.section,
          inLanguage: defaultMeta.locale,
          author: {
            '@type': 'Organization',
            name: defaultMeta.author
          },
          isPartOf: {
            '@type': 'WebSite',
            name: defaultMeta.siteName,
            url: toAbsoluteUrl('/')
          }
        };
      }]
    ]).getOrElse({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: defaultMeta.siteName,
      url: toAbsoluteUrl('/')
    });
  }

  function applyPageMetadata(meta) {
    document.title = meta.documentTitle;
    setNodeAttribute('#meta-description', 'content', meta.description);
    setNodeAttribute('#meta-keywords', 'content', meta.keywords);
    setNodeAttribute('#meta-canonical', 'href', meta.canonicalUrl);
    setNodeAttribute('#meta-og-type', 'content', meta.type);
    setNodeAttribute('#meta-og-url', 'content', meta.canonicalUrl);
    setNodeAttribute('#meta-og-title', 'content', meta.documentTitle);
    setNodeAttribute('#meta-og-description', 'content', meta.description);
    setNodeAttribute('#meta-og-image', 'content', meta.imageUrl);
    setNodeAttribute('#meta-og-image-alt', 'content', meta.imageAlt);
    setNodeAttribute('#meta-article-section', 'content', meta.section);
    setNodeAttribute('#meta-twitter-url', 'content', meta.canonicalUrl);
    setNodeAttribute('#meta-twitter-title', 'content', meta.documentTitle);
    setNodeAttribute('#meta-twitter-description', 'content', meta.description);
    setNodeAttribute('#meta-twitter-image', 'content', meta.imageUrl);
    setNodeAttribute('#meta-twitter-image-alt', 'content', meta.imageAlt);
    setNodeText('#structured-data', JSON.stringify(buildStructuredData(meta), null, 2));
  }

  function parseIndexLine(line) {
    const trimmed = line.trim();
    return multiMatch(trimmed, [
      [function (value) {
        return /^##\s+(.+)/.test(value);
      }, function (value) {
        const sectionMatch = value.match(/^##\s+(.+)/);
        return { type: 'section', label: sectionMatch[1] };
      }],
      [function (value) {
        return /^#\s+(.+)/.test(value);
      }, function (value) {
        const titleMatch = value.match(/^#\s+(.+)/);
        return { type: 'title', label: titleMatch[1] };
      }],
      [function (value) {
        return /^-\s+\[([^\]]+)\]\(([^)]+)\)/.test(value);
      }, function (value) {
        const linkMatch = value.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)/);
        return { type: 'item', label: linkMatch[1], path: linkMatch[2] };
      }],
      [_, function () {
        return { type: 'noop' };
      }]
    ]).getOrElse({ type: 'noop' });
  }

  const applyIndexEntry = createDispatcher([
    ['title', function (state, entry) {
      return {
        title: entry.label,
        sections: state.sections,
        current: state.current
      };
    }],
    ['section', function (state, entry) {
      const section = { label: entry.label, items: [] };
      return {
        title: state.title,
        sections: state.sections.concat([section]),
        current: section
      };
    }],
    ['item', function (state, entry) {
      return addItemToCurrentSection(state, entry);
    }],
    ['noop', function (state) {
      return state;
    }]
  ]);

  function parseIndex(md) {
    return md.split('\n').reduce(function (state, line) {
      const entry = parseIndexLine(line);
      return applyIndexEntry.dispatch(entry.type, state, entry).getOrElse(state);
    }, { title: defaultMeta.siteName, sections: [], current: null });
  }

  function createPageCatalogEntry(item, section) {
    return {
      label: item.label,
      path: item.path,
      section: section,
      normalizedLabel: normalizeCommandText(item.label),
      normalizedPath: normalizeCommandText(item.path),
      searchText: normalizeCommandText([item.label, section, item.path, toCleanPath(item.path)].join(' '))
    };
  }

  function buildNav(sections) {
    nav.innerHTML = '';
    navIndex = {};
    pageCatalog = [];
    sections.filter(function (sec) {
      return sec.label !== 'Header' && sec.label !== 'Footer';
    }).forEach(function (sec) {
      const div = document.createElement('div');
      div.className = 'nav-section';

      const label = document.createElement('div');
      label.className = 'nav-section-label';
      label.textContent = sec.label;
      label.addEventListener('click', (function (d) {
        return function () { d.classList.toggle('open'); };
      })(div));
      div.appendChild(label);

      const items = document.createElement('div');
      items.className = 'nav-section-items';
      sec.items.forEach(function (item) {
        const a = document.createElement('a');
        a.className = 'nav-item';
        a.textContent = item.label;
        a.dataset.path = item.path;
        a.href = toCleanPath(item.path);
        navIndex[item.path] = {
          label: item.label,
          section: sec.label
        };
        pageCatalog.push(createPageCatalogEntry(item, sec.label));
        a.addEventListener('click', onNavClick);
        items.appendChild(a);
      });
      div.appendChild(items);
      nav.appendChild(div);
    });
  }

  function buildPageHeader(title, sections) {
    pageHeader.innerHTML = '';
    const branding = document.createElement('div');
    branding.className = 'header-branding';

    const logoLink = document.createElement('a');
    logoLink.className = 'header-brand-link header-brand-link-logo';
    logoLink.href = forbocAiUrl;
    logoLink.target = '_blank';
    logoLink.rel = 'noreferrer';
    logoLink.setAttribute('aria-label', 'Visit forboc.ai');
    logoLink.innerHTML = '<div class="logo-icon"></div>';

    const titleLink = document.createElement('a');
    titleLink.className = 'header-brand-link header-brand-link-title';
    titleLink.href = frontierOfJeffersonUrl;
    titleLink.target = '_blank';
    titleLink.rel = 'noreferrer';
    titleLink.textContent = title;

    branding.appendChild(logoLink);
    branding.appendChild(titleLink);
    pageHeader.appendChild(branding);

    const headerNav = document.createElement('nav');
    headerNav.className = 'header-nav';

    sections.filter(function (sec) {
      return sec.label === 'Header';
    }).forEach(function (sec) {
      sec.items.forEach(function (item) {
        const a = document.createElement('a');
        a.textContent = item.label;
        a.dataset.path = item.path;
        a.href = toCleanPath(item.path);
        a.addEventListener('click', onNavClick);
        headerNav.appendChild(a);
      });
    });
    pageHeader.appendChild(headerNav);
  }

  function buildPageFooter(sections) {
    pageFooter.innerHTML = '';
    const copyright = document.createElement('a');
    copyright.className = 'footer-copyright';
    copyright.href = forbocAiUrl;
    copyright.target = '_blank';
    copyright.rel = 'noreferrer';
    copyright.textContent = '© 2026 ForbocAI, Inc.';
    pageFooter.appendChild(copyright);

    const footerItems = sections.filter(function (sec) {
      return sec.label === 'Footer';
    }).reduce(function (items, sec) {
      return items.concat(sec.items);
    }, []);

    if (footerItems.length > 0) {
      const footerLinks = document.createElement('nav');
      footerLinks.className = 'footer-links';

      footerItems.forEach(function (item) {
        const a = document.createElement('a');
        a.textContent = item.label;
        a.dataset.path = item.path;
        a.href = toCleanPath(item.path);
        a.addEventListener('click', onNavClick);
        footerLinks.appendChild(a);
      });
      pageFooter.appendChild(footerLinks);
    }

    pageFooter.appendChild(buildFooterTerminal());
  }

  function isMobileViewport() {
    return window.innerWidth <= 720;
  }

  function currentHeaderNav() {
    return pageHeader.querySelector('.header-nav');
  }

  function setExpandedState(node, isExpanded) {
    node && node.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    setExpandedState(toggle, false);
  }

  function closeHeaderMenu() {
    const headerNav = currentHeaderNav();
    headerNav && headerNav.classList.remove('open');
    setExpandedState(headerToggle, false);
  }

  function terminalLine(kind, text) {
    if (!terminalOutput) {
      return;
    }

    const line = document.createElement('div');
    line.className = 'footer-terminal-line footer-terminal-line-' + kind;
    line.textContent = text;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function terminalLines(kind, lines) {
    lines.forEach(function (line) {
      terminalLine(kind, line);
    });
  }

  function clearTerminalOutput() {
    terminalOutput && (terminalOutput.innerHTML = '');
  }

  function describePage(entry) {
    return entry.section + ' / ' + entry.label;
  }

  function currentPageEntryMaybe() {
    return activePath && navIndex[activePath]
      ? just({
          label: navIndex[activePath].label,
          path: activePath,
          section: navIndex[activePath].section
        })
      : nothing();
  }

  function findPageMatches(query) {
    const normalizedQuery = normalizeCommandText(query);

    if (!normalizedQuery) {
      return [];
    }

    const exactMatches = pageCatalog.filter(function (entry) {
      return entry.normalizedLabel === normalizedQuery
        || entry.normalizedPath === normalizedQuery
        || entry.searchText === normalizedQuery;
    });

    if (exactMatches.length > 0) {
      return exactMatches;
    }

    const prefixMatches = pageCatalog.filter(function (entry) {
      return entry.normalizedLabel.indexOf(normalizedQuery) === 0
        || entry.normalizedPath.indexOf(normalizedQuery) === 0
        || entry.searchText.indexOf(normalizedQuery) === 0;
    });

    if (prefixMatches.length > 0) {
      return prefixMatches;
    }

    return pageCatalog.filter(function (entry) {
      return entry.searchText.indexOf(normalizedQuery) >= 0;
    });
  }

  function summarizedMatches(matches) {
    const limited = matches.slice(0, 5).map(describePage);
    return matches.length > 5
      ? limited.concat(['+' + (matches.length - 5) + ' more']).join(', ')
      : limited.join(', ');
  }

  function groupedPageLines(entries) {
    const grouped = entries.reduce(function (groups, entry) {
      const bucket = groups[entry.section] || [];
      groups[entry.section] = bucket.concat([entry.label]);
      return groups;
    }, {});

    return Object.keys(grouped).map(function (section) {
      return section + ': ' + grouped[section].join(', ');
    });
  }

  function openPageQuery(query) {
    const matches = findPageMatches(query);

    if (matches.length === 0) {
      terminalLine('error', 'No page matched "' + query + '". Try "pages" or "help".');
      return false;
    }

    if (matches.length > 1) {
      terminalLine('error', 'Multiple matches for "' + query + '": ' + summarizedMatches(matches));
      return false;
    }

    loadPage(matches[0].path);
    terminalLine('success', 'Opened ' + describePage(matches[0]) + '.');
    return true;
  }

  function runTerminalCommand(rawCommand) {
    const commandText = trimText(rawCommand || '');

    if (!commandText) {
      return;
    }

    terminalLine('command', '> ' + commandText);

    if (commandText.toLowerCase() === 'clear') {
      clearTerminalOutput();
      return;
    }

    const commandMatch = commandText.match(/^(\S+)(?:\s+(.+))?$/);
    const command = commandMatch ? commandMatch[1].toLowerCase() : '';
    const args = trimText(commandMatch && commandMatch[2] ? commandMatch[2] : '');

    switch (command) {
      case 'help':
        terminalLines('info', [
          'help: show available commands',
          'open <page>: navigate to a page',
          'pages [term]: list pages, optionally filtered',
          'where: show the current page',
          'home: open the introduction',
          'clear: clear the console',
          'Tip: you can also type a page name directly, like "french gulch".'
        ]);
        return;
      case 'open':
      case 'goto':
      case 'go':
      case 'cd':
        if (!args) {
          terminalLine('error', 'Usage: ' + command + ' <page>');
          return;
        }
        openPageQuery(args);
        return;
      case 'pages':
      case 'ls': {
        const matches = args ? findPageMatches(args) : pageCatalog.slice();
        if (matches.length === 0) {
          terminalLine('error', 'No pages matched "' + args + '".');
          return;
        }
        terminalLine('info', matches.length + ' page' + (matches.length === 1 ? '' : 's') + ' available' + (args ? ' for "' + args + '"' : '') + '.');
        terminalLines('info', groupedPageLines(matches));
        return;
      }
      case 'where':
      case 'pwd':
        currentPageEntryMaybe().match({
          just: function (entry) {
            terminalLine('info', 'Current page: ' + describePage(entry) + ' (' + toCleanPath(entry.path) + ')');
          },
          nothing: function () {
            terminalLine('error', 'No page is loaded yet.');
          }
        });
        return;
      case 'home':
        openPageQuery('introduction');
        return;
      default:
        openPageQuery(commandText);
    }
  }

  function onTerminalSubmit(event) {
    event.preventDefault();

    if (!terminalInput) {
      return;
    }

    const value = trimText(terminalInput.value);

    if (!value) {
      return;
    }

    terminalHistory.push(value);
    terminalHistoryIndex = terminalHistory.length;
    terminalDraft = '';
    terminalInput.value = '';
    runTerminalCommand(value);
  }

  function setTerminalInputFromHistory(nextIndex) {
    if (!terminalInput) {
      return;
    }

    if (nextIndex < 0 || nextIndex > terminalHistory.length) {
      return;
    }

    terminalHistoryIndex = nextIndex;
    terminalInput.value = nextIndex === terminalHistory.length
      ? terminalDraft
      : terminalHistory[nextIndex];
  }

  function onTerminalKeyDown(event) {
    if (!terminalInput || terminalHistory.length === 0) {
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (terminalHistoryIndex === terminalHistory.length) {
        terminalDraft = terminalInput.value;
      }
      setTerminalInputFromHistory(Math.max(0, terminalHistoryIndex - 1));
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (terminalHistoryIndex === terminalHistory.length) {
        return;
      }
      setTerminalInputFromHistory(Math.min(terminalHistory.length, terminalHistoryIndex + 1));
    }
  }

  function buildFooterTerminal() {
    const terminal = document.createElement('div');
    terminal.className = 'footer-terminal';

    const output = document.createElement('div');
    output.className = 'footer-terminal-output';
    output.setAttribute('aria-live', 'polite');

    const form = document.createElement('form');
    form.className = 'footer-terminal-form';
    form.addEventListener('submit', onTerminalSubmit);

    const prompt = document.createElement('span');
    prompt.className = 'footer-terminal-prompt';
    prompt.textContent = '>';

    const input = document.createElement('input');
    input.className = 'footer-terminal-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.placeholder = 'help, open french gulch, pages, where';
    input.setAttribute('aria-label', 'Footer terminal');
    input.addEventListener('keydown', onTerminalKeyDown);

    form.appendChild(prompt);
    form.appendChild(input);
    terminal.appendChild(output);
    terminal.appendChild(form);

    terminalOutput = output;
    terminalInput = input;
    terminalHistoryIndex = terminalHistory.length;
    terminalLines('info', [
      'Frontier of Jefferson console ready.',
      'Try "help" or "open french gulch".'
    ]);

    return terminal;
  }

  function onNavClick(e) {
    e.preventDefault();
    const path = e.currentTarget.dataset.path;
    loadPage(path);
    if (isMobileViewport()) {
      closeSidebar();
      closeHeaderMenu();
    }
  }

  function setActive(path) {
    activePath = path;
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item, .header-nav a, .footer-links a'), function (item) {
      const isActive = item.dataset.path === path;
      item.classList.toggle('active', isActive);
      return isActive
        ? fromNullable(item.closest('.nav-section')).map(function (section) {
            section.classList.add('open');
            return item;
          }).getOrElse(item)
        : item;
    });
  }

  function renderMarkdown(md, baseUrl) {
    return compose(
      replace(/<p><\/p>/g, ''),
      replace(/^(?!<[hulo]|<li|<hr|<pre|<block|<img)(.+)$/gm, '<p>$1</p>'),
      function (text) {
        return text.replace(/((?:^>[ ]?.*(?:\n|$))+)/gm, function (block) {
          const inner = block.replace(/^>[ ]?/gm, '').trim().split('\n')
            .map(function (l) { return l.trim(); })
            .filter(function (l) { return l.length > 0; })
            .join('<br>');
          return '<blockquote>' + inner + '</blockquote>';
        });
      },
      replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>'),
      replace(/^(\s*)[\*\-] (.+)$/gm, '<li>$2</li>'),
      replace(/\*([^*]+)\*/g, '<em>$1</em>'),
      replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'),
      replace(/`([^`]+)`/g, '<code>$1</code>'),
      replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'),
      resolveImages(baseUrl),
      replace(/^---+$/gm, '<hr>'),
      replace(/^# (.+)$/gm, '<h1>$1</h1>'),
      replace(/^## (.+)$/gm, '<h2>$1</h2>'),
      replace(/^### (.+)$/gm, '<h3>$1</h3>'),
      replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    )(md);
  }

  function firstNavPathMaybe() {
    return fromNullable(nav.querySelector('.nav-item'))
      .map(function (item) {
        return item.dataset.path;
      })
      .chain(nonEmptyMaybe);
  }

  function resolveHashPathMaybe() {
    const hash = window.location.hash.slice(1);
    return fromNullable(hash)
      .chain(nonEmptyMaybe)
      .map(function (value) {
        history.replaceState(null, '', toCleanPath(value));
        return value;
      });
  }

  function resolvePathnameMaybe() {
    const pathname = window.location.pathname;
    return pathname && pathname !== '/' ? just(toMdPath(pathname)) : nothing();
  }

  function resolveInitialPath() {
    return orElse(
      resolveHashPathMaybe(),
      orElse(
        resolvePathnameMaybe(),
        orElse(firstNavPathMaybe(), '')
      )
    );
  }

  function loadPage(path) {
    setActive(path);
    const cleanUrl = toCleanPath(path);
    window.location.pathname !== cleanUrl && history.pushState(null, '', cleanUrl);
    content.parentElement.classList.toggle('page-introduction', path.indexOf('introduction/') === 0);
    content.innerHTML = '<p class="loading">Loading...</p>';
    fetch('/' + path)
      .then(function (r) {
        return r.ok ? r.text() : Promise.reject(new Error(r.status));
      })
      .then(function (md) {
        applyPageMetadata(buildPageMetadata(md, path));
        content.innerHTML = renderMarkdown(md, '/' + path);
        content.parentElement.scrollTop = 0;
      })
      .catch(function (err) {
        content.innerHTML = '<p class="error">Could not load ' + path + ' (' + err.message + ')</p>';
      });
  }

  toggle.addEventListener('click', function () {
    const willOpen = !sidebar.classList.contains('open');
    closeHeaderMenu();
    sidebar.classList.toggle('open', willOpen);
    setExpandedState(toggle, willOpen);
  });

  headerToggle.addEventListener('click', function () {
    const headerNav = currentHeaderNav();
    const willOpen = headerNav && !headerNav.classList.contains('open');
    closeSidebar();
    headerNav && headerNav.classList.toggle('open', willOpen);
    setExpandedState(headerToggle, Boolean(willOpen));
  });

  sidebarHeader.addEventListener('click', function () {
    const first = nav.querySelector('.nav-item');
    first && loadPage(first.dataset.path);
  });

  // Boot: fetch index.md, build sidebar, load initial page
  fetch('/index.md')
    .then(function (r) {
      return r.ok ? r.text() : Promise.reject(new Error(r.status));
    })
    .then(function (md) {
      const parsedIndex = parseIndex(md);
      sidebarHeader.textContent = parsedIndex.title;
      buildNav(parsedIndex.sections);
      buildPageHeader(parsedIndex.title, parsedIndex.sections);
      buildPageFooter(parsedIndex.sections);
      const initial = resolveInitialPath();
      initial && loadPage(initial);
    })
    .catch(function (err) {
      content.innerHTML = '<p class="error">Could not load index.md (' + err.message + ')</p>';
    });

  window.addEventListener('popstate', function () {
    const path = toMdPath(window.location.pathname);
    path && path !== activePath && loadPage(path);
  });

  document.addEventListener('click', function (event) {
    if (!isMobileViewport()) {
      return;
    }

    const headerNav = currentHeaderNav();
    const target = event.target;
    const clickedSidebar = sidebar.contains(target) || toggle.contains(target);
    const clickedHeaderMenu = (headerNav && headerNav.contains(target)) || headerToggle.contains(target);

    if (!clickedSidebar) {
      closeSidebar();
    }

    if (!clickedHeaderMenu) {
      closeHeaderMenu();
    }
  });

  window.addEventListener('resize', function () {
    if (!isMobileViewport()) {
      closeSidebar();
      closeHeaderMenu();
    }
  });
})(window.functionalCore);
