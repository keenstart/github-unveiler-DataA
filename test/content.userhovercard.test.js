// Test setup for User Hovercard functionality (from feeds)
describe('GitHub Unveiler Extension - User Hovercard from Feeds Functionality', () => {
  // Mock chrome APIs
  global.chrome = {
    runtime: {
      getURL: jest.fn(path => `chrome://extension-id/${path}`),
      sendMessage: jest.fn(),
    },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(),
      },
    },
  };

  // Mock content.js global variables and functions
  let displayNames = {};
  let elementsByUsername = {};
  let fetchDisplayName;
  let registerElement;
  let lastRegisteredCallback;
  let HOVERCARD_PROCESSED_MARKER = "data-ghu-hovercard-processed";
  let processUserHovercard;

  // Helper function to create a mock user hovercard DOM element based on the provided HTML structure
  function createMockUserHovercard(username, existingContent = '') {
    const hovercard = document.createElement('div');
    hovercard.className = 'Popover js-hovercard-content position-absolute';
    hovercard.setAttribute('aria-label', 'User Hovercard');
    hovercard.setAttribute('data-hovercard-target-url', `/users/${username}/hovercard?event_type=feeds.feed_click&hover_target=feed_user_avatar&payload%5Bfeed_card%5D%5Bassignment_context%5D=c-cb738117%3A109742%3B`);
    hovercard.style.cssText = 'display: block; outline: none; top: 134px !important; bottom: auto !important; left: 507.5px; z-index: 100;';
    
    const popoverMessage = document.createElement('div');
    popoverMessage.className = 'Popover-message Popover-message--large Box color-shadow-large Popover-message--bottom-left';
    popoverMessage.style.width = '360px';
    
    const innerDiv = document.createElement('div');
    
    const mainContent = document.createElement('div');
    mainContent.className = 'px-3 pb-3';
    mainContent.setAttribute('data-view-component', 'true');
    mainContent.innerHTML = existingContent || `
      <div class="d-flex mt-3 position-relative overflow-hidden">
        <div class="d-flex flex-column width-fit">
          <section aria-label="User avatar" class="rounded-2 overflow-hidden">
            <a class="user-hovercard-avatar" href="/${username}">
              <img class="d-block avatar-user" src="https://avatars.githubusercontent.com/u/394547?s=96&v=4" width="48" height="48" alt="@${username}">
            </a>
          </section>
          <section aria-label="User login and name" class="d-inline-flex mt-2">
            <a class="f5 text-bold Link--primary no-underline" href="/${username}">${username}</a>
            <span data-view-component="true" class="Truncate">
              <span style="max-width: 230px;" data-view-component="true" class="Truncate-text Truncate-text--expandable">
                <a class="Link--secondary no-underline ml-1" href="/${username}">Test User</a>
              </span>
            </span>
          </section>
          <section aria-label="User bio" class="mt-1 dashboard-break-word">
            <div>Test bio</div>
          </section>
          <address aria-label="User location" class="mt-2 color-fg-muted text-small d-flex flex-items-center" style="font-style: initial;">
            <span class="ml-1">Test Location</span>
          </address>
        </div>
      </div>
    `;
    
    innerDiv.appendChild(mainContent);
    popoverMessage.appendChild(innerDiv);
    hovercard.appendChild(popoverMessage);
    document.body.appendChild(hovercard);
    return hovercard;
  }

  function findNewRowInUserHovercard(hovercardElement) {
    return hovercardElement.querySelector('div[data-testid="ghu-user-extension-row"]');
  }

  beforeAll(() => {
    // Define processUserHovercard for testing
    global.processUserHovercard = function(hovercardElement) {
      if (hovercardElement.hasAttribute(HOVERCARD_PROCESSED_MARKER)) {
        return;
      }

      let username;
      // Extract username from data-hovercard-target-url attribute
      const targetUrl = hovercardElement.getAttribute("data-hovercard-target-url");
      if (targetUrl) {
        const match = targetUrl.match(/\/users\/([^\/\?]+)/);
        if (match) {
          username = match[1];
        }
      }

      if (!username) {
        return;
      }

      const processUpdate = (userData) => {
        if (hovercardElement.hasAttribute(HOVERCARD_PROCESSED_MARKER)) {
          return;
        }
        
        const iconUrl = global.chrome.runtime.getURL("icon16.png");

        const newRow = document.createElement("div");
        newRow.classList.add("d-flex", "flex-items-baseline", "f6", "mt-1", "color-fg-muted");
        newRow.style.cursor = "pointer";
        newRow.setAttribute('data-testid', 'ghu-user-extension-row');

        const iconContainer = document.createElement('div');
        iconContainer.classList.add("mr-1", "flex-shrink-0");

        const iconImg = document.createElement('img');
        iconImg.src = iconUrl;
        iconImg.alt = "Extension icon";
        iconImg.style.width = "16px";
        iconImg.style.height = "16px";
        iconImg.style.verticalAlign = "middle";

        iconContainer.appendChild(iconImg);

        const textContainer = document.createElement('span');
        textContainer.classList.add("lh-condensed", "overflow-hidden", "no-wrap");
        textContainer.style.textOverflow = "ellipsis";
        textContainer.textContent = userData;
        
        newRow.appendChild(iconContainer);
        newRow.appendChild(textContainer);

        newRow.addEventListener("click", () => {
          global.chrome.runtime.sendMessage({ type: "openOptionsPage", url: `options.html#${username}` });
        });

        // Find the content container - look for the main user info section
        const appendTarget = hovercardElement.querySelector('.px-3.pb-3') || 
                           hovercardElement.querySelector('div[data-view-component="true"].px-3.pb-3') ||
                           hovercardElement.querySelector('.Popover-message > div') ||
                           hovercardElement;
        
        // Check if extension row already exists
        let existingExtensionRow = appendTarget.querySelector('img[alt="Extension icon"]');
        if (!existingExtensionRow) {
          appendTarget.appendChild(newRow);
        }

        hovercardElement.setAttribute(HOVERCARD_PROCESSED_MARKER, "true");
      };

      if (displayNames[username]) {
        processUpdate(displayNames[username]);
      } else {
        registerElement(username, processUpdate);
        fetchDisplayName(username);
      }
    };
    
    processUserHovercard = global.processUserHovercard;
  });

  beforeEach(() => {
    // Reset mocks and global caches
    displayNames = {};
    elementsByUsername = {};
    lastRegisteredCallback = null; 
    fetchDisplayName = jest.fn();
    registerElement = jest.fn((username, cb) => {
      if (!elementsByUsername[username]) {
        elementsByUsername[username] = [];
      }
      elementsByUsername[username].push(cb);
      lastRegisteredCallback = cb;
    });
    chrome.runtime.getURL.mockClear();
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.get.mockClear();
    // Clear the document body
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('Extracts username correctly from data-hovercard-target-url', () => {
    const hovercard = createMockUserHovercard('SethRobinson');
    processUserHovercard(hovercard);

    expect(fetchDisplayName).toHaveBeenCalledWith('SethRobinson');
    expect(registerElement).toHaveBeenCalledWith('SethRobinson', expect.any(Function));
  });

  test('Adds new row with icon and display name when data is fetched', () => {
    const hovercard = createMockUserHovercard('testuser');
    processUserHovercard(hovercard);

    expect(fetchDisplayName).toHaveBeenCalledWith('testuser');
    expect(registerElement).toHaveBeenCalledWith('testuser', expect.any(Function));
    expect(lastRegisteredCallback).toBeDefined();

    // Simulate fetchDisplayName resolving by calling the registered callback
    const userData = 'Test User Display Name';
    lastRegisteredCallback(userData);
    
    const newRow = findNewRowInUserHovercard(hovercard);
    expect(newRow).not.toBeNull();

    // Verify classes on newRow
    expect(newRow.classList.contains('d-flex')).toBe(true);
    expect(newRow.classList.contains('flex-items-baseline')).toBe(true);
    expect(newRow.classList.contains('f6')).toBe(true);
    expect(newRow.classList.contains('mt-1')).toBe(true);
    expect(newRow.classList.contains('color-fg-muted')).toBe(true);
    expect(newRow.style.cursor).toBe('pointer');

    const iconContainer = newRow.querySelector('div.mr-1.flex-shrink-0');
    expect(iconContainer).not.toBeNull();
    
    const img = iconContainer.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.src).toBe('chrome://extension-id/icon16.png');
    expect(img.alt).toBe('Extension icon');
    expect(img.style.width).toBe('16px');
    expect(img.style.height).toBe('16px');

    const textContainer = newRow.querySelector('span.lh-condensed.overflow-hidden.no-wrap');
    expect(textContainer).not.toBeNull();
    expect(textContainer.style.textOverflow).toBe('ellipsis');
    expect(textContainer.textContent).toBe('Test User Display Name');
    
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(true);
  });

  test('Uses data directly from displayNames cache if present', () => {
    displayNames['cacheduser'] = 'Cached User Display';
    
    const hovercard = createMockUserHovercard('cacheduser');
    processUserHovercard(hovercard);

    const newRow = findNewRowInUserHovercard(hovercard);
    expect(newRow).not.toBeNull();
    const textContainer = newRow.querySelector('span.lh-condensed');
    expect(textContainer.textContent).toBe('Cached User Display');
    expect(fetchDisplayName).not.toHaveBeenCalledWith('cacheduser');
    expect(registerElement).not.toHaveBeenCalledWith('cacheduser', expect.any(Function));
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(true);
  });

  test('Clicking the row sends the correct openOptionsPage message', () => {
    const hovercard = createMockUserHovercard('testuserclick');
    processUserHovercard(hovercard);
    expect(lastRegisteredCallback).toBeDefined();

    const userData = 'Clickable User';
    lastRegisteredCallback(userData);

    const newRow = findNewRowInUserHovercard(hovercard);
    expect(newRow).not.toBeNull();
    
    newRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'openOptionsPage',
      url: 'options.html#testuserclick'
    });
  });

  test('Does not re-process if HOVERCARD_PROCESSED_MARKER is present', () => {
    const hovercard = createMockUserHovercard('processeduser', '<span>Original Content</span>');
    hovercard.setAttribute(HOVERCARD_PROCESSED_MARKER, 'true');
    
    processUserHovercard(hovercard);

    const newRow = findNewRowInUserHovercard(hovercard);
    expect(newRow).toBeNull();
    const contentContainer = hovercard.querySelector('.px-3.pb-3');
    expect(contentContainer.innerHTML).toBe('<span>Original Content</span>');
    expect(fetchDisplayName).not.toHaveBeenCalled();
    expect(registerElement).not.toHaveBeenCalled();
  });

  test('Does not process if no data-hovercard-target-url attribute', () => {
    const hovercard = document.createElement('div');
    hovercard.className = 'Popover js-hovercard-content position-absolute';
    hovercard.setAttribute('aria-label', 'User Hovercard');
    // Missing data-hovercard-target-url
    const mainContent = document.createElement('div');
    mainContent.className = 'px-3 pb-3';
    hovercard.appendChild(mainContent);
    document.body.appendChild(hovercard);
    
    processUserHovercard(hovercard);

    const newRow = findNewRowInUserHovercard(hovercard);
    expect(newRow).toBeNull();
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(false);
    expect(fetchDisplayName).not.toHaveBeenCalled();
  });

  test('Does not process if data-hovercard-target-url does not contain /users/', () => {
    const hovercard = createMockUserHovercard('testuser');
    hovercard.setAttribute('data-hovercard-target-url', '/repos/owner/repo/hovercard');
    
    processUserHovercard(hovercard);

    const newRow = findNewRowInUserHovercard(hovercard);
    expect(newRow).toBeNull();
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(false);
    expect(fetchDisplayName).not.toHaveBeenCalled();
  });

  test('Handles usernames with special characters correctly', () => {
    const hovercard = createMockUserHovercard('user-name.test123');
    processUserHovercard(hovercard);

    expect(fetchDisplayName).toHaveBeenCalledWith('user-name.test123');
    expect(registerElement).toHaveBeenCalledWith('user-name.test123', expect.any(Function));
  });

  test('Does not add multiple extension rows for the same hovercard', () => {
    const hovercard = createMockUserHovercard('duplicateuser');
    
    // Add an existing extension row
    const contentContainer = hovercard.querySelector('.px-3.pb-3');
    const existingRow = document.createElement('div');
    const existingIcon = document.createElement('img');
    existingIcon.alt = 'Extension icon';
    existingRow.appendChild(existingIcon);
    contentContainer.appendChild(existingRow);
    
    displayNames['duplicateuser'] = 'Duplicate User';
    processUserHovercard(hovercard);

    const extensionRows = contentContainer.querySelectorAll('img[alt="Extension icon"]');
    expect(extensionRows.length).toBe(1); // Should still be only 1
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(true);
  });

  test('Handles fallback append targets correctly', () => {
    const hovercard = document.createElement('div');
    hovercard.className = 'Popover js-hovercard-content position-absolute';
    hovercard.setAttribute('aria-label', 'User Hovercard');
    hovercard.setAttribute('data-hovercard-target-url', '/users/fallbackuser/hovercard');
    
    // No .px-3.pb-3 container, should fallback to hovercard itself
    document.body.appendChild(hovercard);
    
    displayNames['fallbackuser'] = 'Fallback User';
    processUserHovercard(hovercard);

    const newRow = findNewRowInUserHovercard(hovercard);
    expect(newRow).not.toBeNull();
    expect(newRow.parentElement).toBe(hovercard); // Should be appended directly to hovercard
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(true);
  });
});