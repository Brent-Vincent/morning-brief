(() => {
  if (!['http:', 'https:'].includes(location.protocol)) return;
  const notice = document.getElementById('installNotice');
  const button = document.getElementById('installApp');
  const help = document.getElementById('installHelp');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null;
  const updateNotice = () => {
    notice.hidden = standalone.matches || navigator.standalone === true;
  };
  updateNotice();
  standalone.addEventListener('change', updateNotice);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    updateNotice();
  });
  button.addEventListener('click', async () => {
    if (!installPrompt) {
      help.hidden = !help.hidden;
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') notice.hidden = true;
    } catch (error) {
      help.hidden = false;
    }
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    notice.hidden = true;
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.warn('Offline access is unavailable:', error);
      });
    });
  }
})();
