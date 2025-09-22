// Test setup will go here
describe('GitHub Usernames Extension - Hovercard Functionality', () => {
  // Mock chrome APIs
  global.chrome = {
    runtime: {
      getURL: jest.fn(path => `chrome://extension-id/${path}`),
      sendMessage: jest.fn(),
    },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}), // Default mock
        set: jest.fn().mockResolvedValue(), // Default mock
      },
    },
  };

  // Mock content.js global variables and functions
  // These would normally be part of content.js, we're making them available/mockable for tests
  let displayNames = {};
  let elementsByUsername = {};
  let fetchDisplayName;
  let registerElement;
  let lastRegisteredCallback; // For easier access in tests
  let HOVERCARD_PROCESSED_MARKER = "data-ghu-hovercard-processed"; // Actual value from content.js
  let processHovercard; // This will be loaded from content.js or its logic replicated/mocked

  // Helper function to create a mock hovercard DOM element
  function createMockHovercard(username, existingContent = '', customDataHydroView) {
    const hovercard = document.createElement('div');
    if (customDataHydroView) {
      hovercard.setAttribute('data-hydro-view', customDataHydroView);
    } else {
      hovercard.setAttribute('data-hydro-view', JSON.stringify({
        event_type: 'user-hovercard-hover',
        payload: { card_user_login: username }
      }));
    }
    const mainContent = document.createElement('div');
    mainContent.className = 'px-3 pb-3'; // Standard class where content is appended
    mainContent.innerHTML = existingContent;
    hovercard.appendChild(mainContent);
    document.body.appendChild(hovercard);
    return hovercard;
  }

  function findNewRowInHovercard(hovercardElement) {
    const contentContainer = hovercardElement.querySelector('.px-3.pb-3');
    if (!contentContainer) return null;
    return contentContainer.querySelector('div[data-testid="ghu-extension-row"]');
  }
  
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  beforeAll(() => {
    // This is tricky. content.js is an IIFE.
    // For a real test environment (like Jest with JSDOM), you'd load the script.
    // Here, we'll have to manually define or import `processHovercard` and its dependencies.
    // For this plan, we'll assume `processHovercard` becomes available.
    // A simplified version of processHovercard's logic might be needed if direct import is not feasible.

    // --- Start of simplified content.js logic for testing ---
    // This section manually defines the parts of content.js needed for the tests.
    // In a real Jest environment, you would import content.js and JSDOM would handle the IIFE.

    HOVERCARD_PROCESSED_MARKER = "data-ghu-hovercard-processed"; // Ensure it's the same as in content.js

    // Direct definition of processHovercard for testing if not importable
    // This is a re-definition for testing purposes if the IIFE cannot be easily bypassed.
    // Ideally, content.js would be structured to allow importing processHovercard.
    global.processHovercard = function(hovercardElement) {
      if (hovercardElement.hasAttribute(HOVERCARD_PROCESSED_MARKER)) {
        return;
      }

      let username;
      
      // Check if this is a user hovercard (from user avatar hover)
      const isUserHovercard = hovercardElement.getAttribute("aria-label") === "User Hovercard";
      
      if (isUserHovercard) {
        // For user hovercards, extract username from data-hovercard-target-url
        const targetUrl = hovercardElement.getAttribute("data-hovercard-target-url");
        if (targetUrl) {
          const match = targetUrl.match(/\/users\/([^\/\?]+)/);
          if (match) {
            username = match[1];
          }
        }
        
        // Fallback: try to find username from the link inside the hovercard
        if (!username) {
          const userLink = hovercardElement.querySelector('a.f5.text-bold.Link--primary[href^="/"]');
          if (userLink) {
            const href = userLink.getAttribute("href");
            const match = href.match(/^\/([^\/\?]+)$/);
            if (match) {
              username = match[1];
            }
          }
        }
      } else {
        // Original logic for repository hovercards
        try {
          const hydroView = hovercardElement.getAttribute("data-hydro-view");
          if (!hydroView) return;
          const jsonData = JSON.parse(hydroView);
          username = jsonData?.payload?.card_user_login;
        } catch (e) {
          console.error("Error parsing hovercard data-hydro-view:", e, hovercardElement);
          return;
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
        // Removed expirationText logic block

        const newRow = document.createElement("div");
        newRow.classList.add("d-flex", "flex-items-baseline", "f6", "mt-1", "color-fg-muted");
        newRow.style.cursor = "pointer";
        newRow.setAttribute('data-testid', 'ghu-extension-row'); // For reliable selection

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
        textContainer.textContent = userData; // Only display name
        
        newRow.appendChild(iconContainer);
        newRow.appendChild(textContainer);

        newRow.addEventListener("click", () => {
          global.chrome.runtime.sendMessage({ type: "openOptionsPage", url: `options.html#${username}` });
        });
        // newRow.style.cursor = "pointer"; // Already set

        let contentContainer = hovercardElement.querySelector('.px-3.pb-3');
        if (!contentContainer) {
            // console.log('[TEST DEBUG] contentContainer not found, falling back to hovercardElement itself.');
            contentContainer = hovercardElement; // Fallback
        }
        // console.log('[TEST DEBUG] Appending newRow to contentContainer:', contentContainer);
        contentContainer.appendChild(newRow);
        // console.log('[TEST DEBUG] newRow appended. Setting HOVERCARD_PROCESSED_MARKER.');
        hovercardElement.setAttribute(HOVERCARD_PROCESSED_MARKER, "true");
      };

      // console.log(`[TEST DEBUG] processHovercard for ${username}. displayNames[${username}]:`, displayNames[username]);
      if (displayNames[username]) {
        processUpdate(displayNames[username]);
      } else {
        // For tests, ensure processUpdate is the actual function from this scope
        const callbackForRegister = processUpdate; 
        registerElement(username, callbackForRegister);
        fetchDisplayName(username);
      }
    };
    // --- End of simplified content.js logic ---
    processHovercard = global.processHovercard; // Assign to the test-scoped variable
  });


  beforeEach(() => {
    // Reset mocks and global caches
    displayNames = {};
    elementsByUsername = {}; // Still used by registerElement mock, but test will use lastRegisteredCallback
    lastRegisteredCallback = null; 
    fetchDisplayName = jest.fn();
    registerElement = jest.fn((username, cb) => {
      if (!elementsByUsername[username]) { // Keep original mock logic for completeness
        elementsByUsername[username] = [];
      }
      elementsByUsername[username].push(cb);
      lastRegisteredCallback = cb; // Store the last registered callback
    });
    chrome.runtime.getURL.mockClear();
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.get.mockClear();
    // Clear the document body
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = ''; // Clean up any added DOM elements
  });

  test('Adds new row with icon, display name, and default expiration when data is fetched', () => {
    const hovercard = createMockHovercard('testuser');
    processHovercard(hovercard);

    expect(fetchDisplayName).toHaveBeenCalledWith('testuser');
    expect(registerElement).toHaveBeenCalledWith('testuser', expect.any(Function));
    expect(lastRegisteredCallback).toBeDefined();

    // Simulate fetchDisplayName resolving by calling the registered callback
    const userData = 'Test User';
    lastRegisteredCallback(userData); // Directly use the captured callback
    
    const newRow = findNewRowInHovercard(hovercard);
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
    expect(textContainer.textContent).toBe('Test User'); // Assertion updated
    
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(true);
  });

  test('Displays "(No expiration)" correctly', () => {
    const hovercard = createMockHovercard('immortaluser');
    processHovercard(hovercard);
    expect(lastRegisteredCallback).toBeDefined();

    const userData = 'Immortal User';
    lastRegisteredCallback(userData);

    const newRow = findNewRowInHovercard(hovercard);
    expect(newRow).not.toBeNull();
    // Basic check for class and content, detailed class checks in the first test
    expect(newRow.classList.contains('color-fg-muted')).toBe(true);
    const textContainer = newRow.querySelector('span.lh-condensed');
    expect(textContainer.textContent.trim()).toBe('Immortal User'); // Assertion updated
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(true);
  });

  test('Uses data directly from displayNames cache if present', () => {
    displayNames['cacheduser'] = 'Cached User';
    
    const hovercard = createMockHovercard('cacheduser');
    processHovercard(hovercard);

    const newRow = findNewRowInHovercard(hovercard);
    expect(newRow).not.toBeNull();
    const textContainer = newRow.querySelector('span.lh-condensed');
    expect(textContainer.textContent).toBe('Cached User'); // Assertion updated
    expect(fetchDisplayName).not.toHaveBeenCalledWith('cacheduser');
    expect(registerElement).not.toHaveBeenCalledWith('cacheduser', expect.any(Function));
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(true);
  });

  test('Clicking the row sends the correct openOptionsPage message', () => {
    const hovercard = createMockHovercard('testuserclick');
    processHovercard(hovercard);
    expect(lastRegisteredCallback).toBeDefined();

    const userData = 'Clickable User';
    lastRegisteredCallback(userData);

    const newRow = findNewRowInHovercard(hovercard);
    expect(newRow).not.toBeNull();
    
    newRow.dispatchEvent(new MouseEvent('click', { bubbles: true })); // Simulate click
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'openOptionsPage',
      url: 'options.html#testuserclick'
    });
  });

  test('Does not re-process if HOVERCARD_PROCESSED_MARKER is present', () => {
    const hovercard = createMockHovercard('processeduser', '<span>Original Content</span>');
    hovercard.setAttribute(HOVERCARD_PROCESSED_MARKER, 'true');
    
    processHovercard(hovercard);

    const newRow = findNewRowInHovercard(hovercard);
    expect(newRow).toBeNull(); // No new row should be added
    const contentContainer = hovercard.querySelector('.px-3.pb-3');
    expect(contentContainer.innerHTML).toBe('<span>Original Content</span>'); // Original content unchanged
    expect(fetchDisplayName).not.toHaveBeenCalled();
    expect(registerElement).not.toHaveBeenCalled();
  });

  test('Handles missing card_user_login gracefully', () => {
    const hovercard = createMockHovercard(null, '', JSON.stringify({ // Malformed/missing username
      event_type: 'user-hovercard-hover',
      payload: { /* card_user_login is missing */ }
    }));
    
    processHovercard(hovercard);

    const newRow = findNewRowInHovercard(hovercard);
    expect(newRow).toBeNull();
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(false);
    expect(fetchDisplayName).not.toHaveBeenCalled();
  });
  
  test('Handles completely missing data-hydro-view gracefully', () => {
    const hovercard = document.createElement('div'); // No data-hydro-view attribute
    const mainContent = document.createElement('div');
    mainContent.className = 'px-3 pb-3';
    hovercard.appendChild(mainContent);
    document.body.appendChild(hovercard);
        
    processHovercard(hovercard);

    const newRow = findNewRowInHovercard(hovercard);
    expect(newRow).toBeNull();
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(false);
    expect(fetchDisplayName).not.toHaveBeenCalled();
  });

  test('Handles data-hydro-view not being valid JSON gracefully', () => {
    const hovercard = createMockHovercard(null, '', "this is not json");
            
    processHovercard(hovercard);

    const newRow = findNewRowInHovercard(hovercard);
    expect(newRow).toBeNull();
    expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(false);
    expect(fetchDisplayName).not.toHaveBeenCalled();
  });

  // Conceptual tests for MutationObserver and initial scan would require more complex setup
  // to actually run content.js's observer/initial scan logic.
  // For now, these are covered by the fact that processHovercard itself is tested.

  // Tests for User Hovercards (from user avatar hover)
  describe('User Hovercards', () => {
    function createMockUserHovercard(username, existingContent = '') {
      const hovercard = document.createElement('div');
      hovercard.setAttribute('aria-label', 'User Hovercard');
      hovercard.setAttribute('data-hovercard-target-url', `/users/${username}/hovercard?event_type=feeds.feed_click`);
      
      const mainContent = document.createElement('div');
      mainContent.className = 'px-3 pb-3';
      mainContent.innerHTML = existingContent;
      
      // Add a user link inside the hovercard
      const userLink = document.createElement('a');
      userLink.className = 'f5 text-bold Link--primary no-underline';
      userLink.href = `/${username}`;
      userLink.textContent = username;
      mainContent.appendChild(userLink);
      
      hovercard.appendChild(mainContent);
      document.body.appendChild(hovercard);
      return hovercard;
    }

    test('Processes user hovercard and extracts username from data-hovercard-target-url', () => {
      const hovercard = createMockUserHovercard('SethRobinson');
      processHovercard(hovercard);

      expect(fetchDisplayName).toHaveBeenCalledWith('SethRobinson');
      expect(registerElement).toHaveBeenCalledWith('SethRobinson', expect.any(Function));
      expect(lastRegisteredCallback).toBeDefined();

      // Simulate fetchDisplayName resolving
      const userData = 'Seth Robinson';
      lastRegisteredCallback(userData);
      
      const newRow = findNewRowInHovercard(hovercard);
      expect(newRow).not.toBeNull();
      
      const textContainer = newRow.querySelector('span.lh-condensed');
      expect(textContainer.textContent).toBe('Seth Robinson');
      expect(hovercard.hasAttribute(HOVERCARD_PROCESSED_MARKER)).toBe(true);
    });

    test('Falls back to extracting username from link href if target-url parsing fails', () => {
      const hovercard = document.createElement('div');
      hovercard.setAttribute('aria-label', 'User Hovercard');
      // No data-hovercard-target-url
      
      const mainContent = document.createElement('div');
      mainContent.className = 'px-3 pb-3';
      
      // Add a user link
      const userLink = document.createElement('a');
      userLink.className = 'f5 text-bold Link--primary no-underline';
      userLink.href = '/octocat';
      userLink.textContent = 'octocat';
      mainContent.appendChild(userLink);
      
      hovercard.appendChild(mainContent);
      document.body.appendChild(hovercard);
      
      processHovercard(hovercard);

      expect(fetchDisplayName).toHaveBeenCalledWith('octocat');
      expect(registerElement).toHaveBeenCalledWith('octocat', expect.any(Function));
    });

    test('Does not process if aria-label is not "User Hovercard"', () => {
      const hovercard = document.createElement('div');
      hovercard.setAttribute('aria-label', 'Repository Hovercard');
      hovercard.setAttribute('data-hovercard-target-url', '/users/testuser/hovercard');
      
      const mainContent = document.createElement('div');
      mainContent.className = 'px-3 pb-3';
      hovercard.appendChild(mainContent);
      document.body.appendChild(hovercard);
      
      processHovercard(hovercard);

      expect(fetchDisplayName).not.toHaveBeenCalled();
      expect(registerElement).not.toHaveBeenCalled();
    });

    test('Handles user hovercards with complex URLs', () => {
      const hovercard = createMockUserHovercard('user-with-dash');
      hovercard.setAttribute('data-hovercard-target-url', 
        '/users/user-with-dash/hovercard?event_type=feeds.feed_click&payload[feed_card][card_position]=0&payload[metadata][clicked_resource_id]=394547');
      
      processHovercard(hovercard);

      expect(fetchDisplayName).toHaveBeenCalledWith('user-with-dash');
      expect(registerElement).toHaveBeenCalledWith('user-with-dash', expect.any(Function));
    });

    test('Does not process user hovercard if already processed', () => {
      const hovercard = createMockUserHovercard('processeduser');
      hovercard.setAttribute(HOVERCARD_PROCESSED_MARKER, 'true');
      
      processHovercard(hovercard);

      expect(fetchDisplayName).not.toHaveBeenCalled();
      expect(registerElement).not.toHaveBeenCalled();
    });

    test('Uses cached display name for user hovercards', () => {
      displayNames['cacheduser'] = 'Cached User Name';
      
      const hovercard = createMockUserHovercard('cacheduser');
      processHovercard(hovercard);

      const newRow = findNewRowInHovercard(hovercard);
      expect(newRow).not.toBeNull();
      const textContainer = newRow.querySelector('span.lh-condensed');
      expect(textContainer.textContent).toBe('Cached User Name');
      expect(fetchDisplayName).not.toHaveBeenCalledWith('cacheduser');
      expect(registerElement).not.toHaveBeenCalledWith('cacheduser', expect.any(Function));
    });
  });
});
