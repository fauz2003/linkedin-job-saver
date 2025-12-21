(() => {
  // Prevent double-initialization when the script is injected multiple times
  if (window.__linkedin_job_saver_initialized) {
    console.log('LinkedIn Job Saver already initialized.');
    return;
  }
  window.__linkedin_job_saver_initialized = true;

  let running = false;
  let jobsSaved = 0;
  const MAX_SAVES = 25; // max jobs to save per session
  const SCROLL_DELAY = 2000; // 3 seconds scroll delay
  const JOB_VIEW_DELAY = 5000; // 7 seconds to simulate reading
  const INCLUDE_KEYWORDS = [
    'software engineer', 'full stack', 'mern',
    'react', 'node', 'javascript', 'vue', 'nest', 'frontend', 'backend'
  ];
  const EXCLUDE_KEYWORDS = [
    'part-time', 'part time', 'internship', 'intern', 'trainee', 'contract', 'junior'
  ];

  // Listen to messages from popup.js
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.command === 'START') {
      if (!running) {
        running = true;
        jobsSaved = 0;
        // Notify popup that we started
        try { chrome.runtime.sendMessage({ type: 'STATUS', status: 'RUNNING', jobsSaved }); } catch (e) {}
        startJobSaver();
      }
    } else if (msg.command === 'STOP') {
      running = false;
      // Notify popup that we stopped
      try { chrome.runtime.sendMessage({ type: 'STATUS', status: 'STOPPED', jobsSaved }); } catch (e) {}
    }
  });

  // Main function
  async function startJobSaver() {
    const jobCardsSelector = 'li[data-occludable-job-id]';
    // LinkedIn job cards container
    let jobCardsContainer = document.querySelectorAll(jobCardsSelector);

    // If we don't find any yet, wait a moment and try again (page may be dynamic)
    if (!jobCardsContainer || jobCardsContainer.length === 0) {
      await sleep(1000);
      jobCardsContainer = document.querySelectorAll(jobCardsSelector);
    }

    let index = 0;

    while (running && index < jobCardsContainer.length && jobsSaved < MAX_SAVES) {
      const job = jobCardsContainer[index];
      if (!job) break;

      // Scroll job into view
      job.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(SCROLL_DELAY);

      // Open job details
      job.click();
      await sleep(JOB_VIEW_DELAY);

      // Extract job title & description
      const titleEl = document.querySelector('.topcard__title, h1'); // fallback selector
      const descEl = document.querySelector('.description__text, .jobs-description-content__text');
      const text = ((titleEl ? titleEl.innerText : '') + ' ' + (descEl ? descEl.innerText : '')).toLowerCase();

      // Check include/exclude keywords
      const includes = INCLUDE_KEYWORDS.some(k => text.includes(k.toLowerCase()));
      const excludes = EXCLUDE_KEYWORDS.some(k => text.includes(k.toLowerCase()));

      // Save if relevant
      if (includes && !excludes) {
        const saveBtn = document.querySelector('button.jobs-save-button, button[data-control-name="save"]');
        if (saveBtn) {
          const ariaPressed = saveBtn.getAttribute && saveBtn.getAttribute('aria-pressed');
          const ariaLabel = (saveBtn.getAttribute && saveBtn.getAttribute('aria-label')) || '';
          const btnText = (saveBtn.innerText || ariaLabel || '').toLowerCase();
          const alreadySaved = ariaPressed === 'true' || btnText.includes('saved') || btnText.includes('saved job') || saveBtn.classList.contains && saveBtn.classList.contains('saved');

          if (alreadySaved) {
            console.log('Job already saved, skipping:', titleEl ? titleEl.innerText : 'unknown title');
            try { chrome.runtime.sendMessage({ type: 'SKIPPED', jobsSaved, title: titleEl ? titleEl.innerText : '' }); } catch (e) {}
          } else if (btnText.includes('save') || ariaLabel.toLowerCase().includes('save')) {
            saveBtn.click();
            jobsSaved++;
            console.log(`Saved job #${jobsSaved}: ${titleEl ? titleEl.innerText : 'unknown title'}`);
            // Notify popup about saved job count
            try { chrome.runtime.sendMessage({ type: 'SAVED', jobsSaved, title: titleEl ? titleEl.innerText : '' }); } catch (e) {}
          } else {
            // Save button present but text/attributes not recognized
            console.log('Save button found but not actionable, skipping:', titleEl ? titleEl.innerText : 'unknown title');
          }
        } else {
          console.log('Save button not found for job:', titleEl ? titleEl.innerText : 'unknown title');
        }
      }

      index++;
      await sleep(randomInt(2000, 5000)); // random delay between jobs
    }

    running = false;
    console.log('Job saver session complete.');
    // Notify popup that session completed/stopped
    try { chrome.runtime.sendMessage({ type: 'STATUS', status: 'STOPPED', jobsSaved }); } catch (e) {}
  }

  // Utility sleep function
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Random integer between min and max
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

})();
